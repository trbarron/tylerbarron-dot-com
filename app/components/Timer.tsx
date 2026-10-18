import { memo, useEffect, useRef, useState } from 'react';

interface TimerProps {
  timeRemaining: number;
}

const Timer = memo(function Timer({ timeRemaining: initialTime }: TimerProps) {
  const [displayTime, setDisplayTime] = useState(initialTime);
  const workerRef = useRef<Worker | undefined>(undefined);

  useEffect(() => {
    // Create a worker blob
    const workerCode = `
      let timer;
      self.onmessage = (e) => {
        if (e.data.type === 'start') {
          clearInterval(timer);
          let time = Math.max(0, e.data.time);
          self.postMessage(time);
          timer = setInterval(() => {
            time = Math.max(0, time - 0.1);
            self.postMessage(time);
            if (time === 0) {
              clearInterval(timer);
            }
          }, 100);
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    workerRef.current = new Worker(URL.createObjectURL(blob));

    workerRef.current.onmessage = (e) => {
      setDisplayTime(e.data);
    };

    // Start the worker with initial time
    workerRef.current.postMessage({ type: 'start', time: initialTime });

    return () => {
      workerRef.current?.terminate();
    };
  }, [initialTime]);

  // Calculate progress percentage
  const progress = (displayTime / initialTime) * 100;

  return (
    <div className="w-full">
      <div className="relative h-4 overflow-hidden rounded-full border border-black bg-gray-200">
        {/* eslint-disable react/forbid-dom-props */}
        <div className="bg-accent absolute h-full transition-all" style={{ width: `${progress}%` }} />
        {/* eslint-enable react/forbid-dom-props */}
      </div>
      <div className="font-neo mt-1 text-center text-sm font-bold text-black">{displayTime.toFixed(1)}s</div>
    </div>
  );
});

export default Timer;
