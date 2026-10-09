import type { ReactNode } from 'react';

export function PhoneFrame({ children, scale = 1 }: { children: ReactNode; scale?: number }) {
  return (
    <div className="relative shrink-0" style={{ width: 390 * scale, height: 844 * scale }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: 390, height: 844, transform: `scale(${scale})` }}>
        <div className="phone-shell relative h-full w-full rounded-[58px] p-[11px]">
          <div className="relative h-full w-full overflow-hidden rounded-[47px] bg-g-925 ring-1 ring-black">
            {children}
            <div className="pointer-events-none absolute left-1/2 top-[11px] z-[80] h-[33px] w-[120px] -translate-x-1/2 rounded-full bg-black" />
          </div>
          <span className="absolute -left-[3px] top-[150px] h-[30px] w-[3px] rounded-l bg-g-600" />
          <span className="absolute -left-[3px] top-[200px] h-[56px] w-[3px] rounded-l bg-g-600" />
          <span className="absolute -left-[3px] top-[268px] h-[56px] w-[3px] rounded-l bg-g-600" />
          <span className="absolute -right-[3px] top-[220px] h-[88px] w-[3px] rounded-r bg-g-600" />
        </div>
      </div>
    </div>
  );
}
