import { useState, useEffect, useCallback } from "react";
import { Calculator, Delete, X } from "lucide-react";
import "./AmountInput.css";

const enDigits = (v: string) => v.replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function AmountInput({ value, onChange, placeholder, disabled }: AmountInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expression, setExpression] = useState("");
  const [display, setDisplay] = useState("");

  const formattedValue = value ? new Intl.NumberFormat("fa-IR").format(Number(enDigits(value).replace(/[^0-9]/g, ""))) : "";

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = enDigits(e.target.value).replace(/[^0-9]/g, "");
    onChange(raw);
  };

  const openCalculator = () => {
    setExpression(enDigits(value).replace(/[^0-9]/g, ""));
    setDisplay(formattedValue);
    setIsOpen(true);
  };

  const handleCalcClick = useCallback((val: string) => {
    if (val === "AC") {
      setExpression("");
      setDisplay("0");
      return;
    }
    if (val === "Del") {
      setExpression(prev => prev.slice(0, -1));
      return;
    }
    if (val === "=") {
      try {
        const sanitized = expression.replace(/×/g, "*").replace(/÷/g, "/");
        if (!/^[0-9+\-*/.() ]+$/.test(sanitized) || sanitized === "") throw new Error("Invalid");
        
        const result = new Function('"use strict";return (' + sanitized + ')')();
        if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
          const finalNum = Math.round(result);
          onChange(String(finalNum));
          setIsOpen(false);
        }
      } catch {
        setDisplay("خطا");
      }
      return;
    }
    
    if (display === "خطا") setDisplay("0");

    setExpression(prev => {
      const newExpr = prev + val;
      try {
        const sanitized = newExpr.replace(/×/g, "*").replace(/÷/g, "/");
        if (/^[0-9+\-*/.() ]+$/.test(sanitized) && sanitized !== "") {
          const result = new Function('"use strict";return (' + sanitized + ')')();
          if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
            setDisplay(new Intl.NumberFormat("fa-IR").format(Math.round(result)));
          }
        }
      } catch {
        // ignore
      }
      return newExpr;
    });
  }, [expression, display, onChange]);

  // اتصال به کیبورد فیزیکی
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      
      if (/^[0-9]$/.test(key)) {
        handleCalcClick(key);
      } else if (key === "+" || key === "-") {
        handleCalcClick(key);
      } else if (key === "*") {
        handleCalcClick("×");
      } else if (key === "/") {
        e.preventDefault(); 
        handleCalcClick("÷");
      } else if (key === "Enter" || key === "=") {
        e.preventDefault();
        handleCalcClick("=");
      } else if (key === "Backspace") {
        handleCalcClick("Del");
      } else if (key === "Escape") {
        setIsOpen(false);
      } else if (key.toLowerCase() === "c") {
        handleCalcClick("AC");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleCalcClick]);

  return (
    <div className="amount-input-wrap">
      <div className="amount-input-box">
        <input
          type="text"
          inputMode="numeric"
          value={formattedValue}
          onChange={handleInputChange}
          placeholder={placeholder || "مبلغ را وارد کنید"}
          disabled={disabled}
        />
        <button type="button" className="calc-btn" onClick={openCalculator} disabled={disabled} title="ماشین‌حساب">
          <Calculator size={18} />
        </button>
      </div>

      {isOpen && (
        <div className="calc-modal-backdrop" onClick={() => setIsOpen(false)}>
          <div className="calc-modal" onClick={e => e.stopPropagation()}>
            <header className="calc-header">
              <div className="calc-screen">
                <small>{expression || "0"}</small>
                <strong>{display || "0"}</strong>
              </div>
              <button className="calc-close" onClick={() => setIsOpen(false)}><X size={20} /></button>
            </header>
            
            <div className="calc-grid">
              <button className="calc-fn" onClick={() => handleCalcClick("AC")}>AC</button>
              <button className="calc-fn" onClick={() => handleCalcClick("Del")}><Delete size={18} /></button>
              <button className="calc-op" onClick={() => handleCalcClick("÷")}>÷</button>
              <button className="calc-op" onClick={() => handleCalcClick("×")}>×</button>
              
              <button onClick={() => handleCalcClick("7")}>7</button>
              <button onClick={() => handleCalcClick("8")}>8</button>
              <button onClick={() => handleCalcClick("9")}>9</button>
              <button className="calc-op" onClick={() => handleCalcClick("-")}>-</button>
              
              <button onClick={() => handleCalcClick("4")}>4</button>
              <button onClick={() => handleCalcClick("5")}>5</button>
              <button onClick={() => handleCalcClick("6")}>6</button>
              <button className="calc-op" onClick={() => handleCalcClick("+")}>+</button>
              
              <button onClick={() => handleCalcClick("1")}>1</button>
              <button onClick={() => handleCalcClick("2")}>2</button>
              <button onClick={() => handleCalcClick("3")}>3</button>
              <button className="calc-eq" onClick={() => handleCalcClick("=")}>=</button>
              
              <button className="calc-zero" onClick={() => handleCalcClick("00")}>00</button>
              <button onClick={() => handleCalcClick("0")}>0</button>
              <button className="calc-zero" onClick={() => handleCalcClick("000")}>000</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}