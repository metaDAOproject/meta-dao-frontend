import React, { useState, useEffect } from 'react';
import { MultiSeriesChart } from '../UI/MultiSeriesChart';

interface TwapData {
  aggregateObservation: number;
  lastObservationValue: number | undefined;
  lastObservedSlot: number;
  midPrice: number | undefined;
  observableTwap: number;
  totalImpact: number;
  twap: number | undefined;
}

interface ConditionalMarketTableProps {
  passTwap?: TwapData;
  failTwap?: TwapData;
}

const MAX_DATA_POINTS = 100;

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function ConditionalMarketTable({ passTwap, failTwap }: ConditionalMarketTableProps) {
  const [passTwapData, setPassTwapData] = useState<{ time: string; value: number }[]>([]);
  const [failTwapData, setFailTwapData] = useState<{ time: string; value: number }[]>([]);

  useEffect(() => {
    if (passTwap) {
      setPassTwapData((prevData) => {
        const newData = [
          ...prevData,
          {
            time: formatDate(passTwap.lastObservedSlot),
            value: passTwap.twap ?? 0,
          },
        ];
        const sortedData = newData.sort(
          (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
        );
        return sortedData.length > MAX_DATA_POINTS
          ? sortedData.slice(-MAX_DATA_POINTS)
          : sortedData;
      });
    }
  }, [passTwap]);

  useEffect(() => {
    if (failTwap) {
      setFailTwapData((prevData) => {
        const newData = [
          ...prevData,
          {
            time: formatDate(failTwap.lastObservedSlot),
            value: failTwap.twap ?? 0,
          },
        ];
        const sortedData = newData.sort(
          (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
        );
        return sortedData.length > MAX_DATA_POINTS
          ? sortedData.slice(-MAX_DATA_POINTS)
          : sortedData;
      });
    }
  }, [failTwap]);

  return (
    <div>
      <MultiSeriesChart
        colors={{
          backgroundColor: 'back',
          textColor: 'white',
        }}
        data={[
          {
            data: passTwapData,
            lineColor: '#2962FF',
            areaTopColor: '#2962FF',
            areaBottomColor: 'rgba(41, 98, 255, 0.28)',
          },
          {
            data: failTwapData,
            lineColor: '#FF5722',
            areaTopColor: '#FF5722',
            areaBottomColor: 'rgba(255, 87, 34, 0.28)',
          },
        ]}
      />
    </div>
  );
}
