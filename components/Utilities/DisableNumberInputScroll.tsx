import { useEffect } from 'react';

const DisableNumberInputScroll = () => {
  useEffect(() => {
    const handleWheel: EventListenerOrEventListenerObject = (e) => {
      e.preventDefault();
    };

    const numberInputs = document.querySelectorAll('input[type="number"]');

    numberInputs.forEach((input) => {
      input.addEventListener('wheel', handleWheel);

      // Clean up the event listener when the component unmounts
      return () => {
        input.removeEventListener('wheel', handleWheel);
      };
    });
  }, []);

  return null;
};

export default DisableNumberInputScroll;
