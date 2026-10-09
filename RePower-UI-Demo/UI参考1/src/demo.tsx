import { createContext, useContext, useState, type ReactNode } from "react";

// 演示控制：用于在“注入执行”时模拟电芯温升异常，展示急停与异常处置流程
interface DemoCtl {
  fault: boolean;
  setFault: (b: boolean) => void;
}
const Ctx = createContext<DemoCtl>({ fault: false, setFault: () => {} });

export function DemoProvider({ children }: { children: ReactNode }) {
  const [fault, setFault] = useState(false);
  return <Ctx.Provider value={{ fault, setFault }}>{children}</Ctx.Provider>;
}

export const useDemo = () => useContext(Ctx);
