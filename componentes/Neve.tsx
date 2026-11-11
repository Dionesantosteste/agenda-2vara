// Neve do Natal: flocos caindo na faixa do topo, por trás do conteúdo.
// Só aparece com data-neve no <html> (época do Natal e a pessoa não desligou em Aparência).
const FLOCOS = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100 + '%',
  tam: 3 + (i * 7 % 5) + 'px',
  dx: (i % 5) * 6 - 12 + 'px',
  dur: 6 + (i * 13 % 7) + 's',
  atraso: '-' + (i * 1.7 % 9).toFixed(1) + 's'
}));

export function Neve(){
  return (
    <div className="neve" aria-hidden="true">
      {FLOCOS.map((f, i) => (
        <i key={i} style={{ left: f.left, width: f.tam, height: f.tam, animationDuration: f.dur, animationDelay: f.atraso, ['--dx' as string]: f.dx }} />
      ))}
    </div>
  );
}
