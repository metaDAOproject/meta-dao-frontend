'use client';

import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import React, { useEffect, useRef } from 'react';

interface ChartProps {
  data: {
    data: { time: string; value: number }[];
    lineColor: string;
    areaTopColor: string;
    areaBottomColor: string;
  }[];
  colors?: {
    backgroundColor?: string;
    textColor?: string;
  };
}

export function MultiSeriesChart(props: ChartProps) {
  const { data, colors: { backgroundColor = 'white', textColor = 'black' } = {} } = props;

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const chart = createChart(chartContainerRef.current!, {
      layout: {
        background: { type: ColorType.Solid, color: backgroundColor },
        textColor,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      width: chartContainerRef.current!.clientWidth,
      height: 300,
    });
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    const seriesInstances = data.map(
      ({
        data: seriesData,
        lineColor = '#2962FF',
        areaTopColor = '#2962FF',
        areaBottomColor = 'rgba(41, 98, 255, 0.28)',
      }) => {
        const newSeries = chart.addAreaSeries({
          lineColor,
          topColor: areaTopColor,
          bottomColor: areaBottomColor,
        });
        newSeries.setData(seriesData);
        return newSeries;
      },
    );

    const tooltip = tooltipRef.current!;
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point || !param.seriesData.size) {
        tooltip.style.display = 'none';
        return;
      }

      const { time, point } = param;
      const dateStr = new Date(Number(time) * 1000).toLocaleDateString();
      const seriesData = param.seriesData.values().next().value;
      const price = seriesData.value !== undefined ? seriesData.value : seriesData.close;

      tooltip.style.display = 'block';
      tooltip.style.left = `${point.x}px`;
      tooltip.style.top = `${point.y}px`;
      tooltip.innerHTML = `<div>Date: ${dateStr}</div><div>Price: ${price}</div>`;
    });

    window.addEventListener('resize', handleResize);

    chartContainerRef.current!.addEventListener('mousemove', (e) => {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const price = seriesInstances[0].coordinateToPrice(y);
      const time = chart.timeScale().coordinateToTime(x);

      if (price !== undefined && price !== null && time !== undefined && time !== null) {
        chart.setCrosshairPosition(price, time, seriesInstances[0]);
      }
    });

    chartContainerRef.current!.addEventListener('mouseleave', () => {
      chart.clearCrosshairPosition();
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      seriesInstances.forEach((seriesInstance) => chart.removeSeries(seriesInstance));
      chart.remove();
    };
  }, [data, backgroundColor, textColor]);

  return (
    <div style={{ position: 'relative' }}>
      <div ref={chartContainerRef} />
      <div
        ref={tooltipRef}
        style={{
          position: 'absolute',
          display: 'none',
          padding: '8px',
          backgroundColor: 'white',
          border: '1px solid black',
          borderRadius: '4px',
          pointerEvents: 'none',
          zIndex: 1000,
        }}
      />
    </div>
  );
}
