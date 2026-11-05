import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

const GridScrollContext = createContext(0);

/** Bumps when the profile scroll moves by a row, so the video grid can recycle tiles. */
export function useGridScrollReporter() {
  const bucketRef = useRef(0);
  const [tick, setTick] = useState(0);
  const onScroll = useCallback((y: number) => {
    const bucket = Math.floor(y / 64);
    if (bucket === bucketRef.current) return;
    bucketRef.current = bucket;
    setTick(bucket);
  }, []);
  return { tick, onScroll };
}

export function ProfileGridScrollProvider({ tick, children }: { tick: number; children: React.ReactNode }) {
  return <GridScrollContext.Provider value={tick}>{children}</GridScrollContext.Provider>;
}

export function useGridScrollTick() {
  return useContext(GridScrollContext);
}
