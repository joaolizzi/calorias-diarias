import { useEffect, useState } from 'react';

// Devolve o valor alvo com um pequeno atraso (2 quadros). Na primeira renderização
// ele começa em `from`, então a barra "sobe" até o valor real; nas mudanças seguintes
// (ex.: depois de registrar água ou comida) a transição de CSS anima do valor anterior
// para o novo. Não altera nenhum dado, só o momento em que a barra recebe o valor.
export default function useGrow(target, from = 0) {
  const [value, setValue] = useState(from);
  useEffect(() => {
    let id2;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setValue(target));
    });
    return () => {
      cancelAnimationFrame(id1);
      if (id2) cancelAnimationFrame(id2);
    };
  }, [target]);
  return value;
}
