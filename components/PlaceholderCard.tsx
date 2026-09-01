export function PlaceholderCard({
  titulo,
  descricao,
  itens,
}: {
  titulo: string;
  descricao: string;
  itens: string[];
}) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">{titulo}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{descricao}</p>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
        Tela ainda não conectada ao backend — o endpoint correspondente já existe na API, mas esta
        interface é só placeholder navegável por enquanto.
      </div>

      <ul className="flex flex-col gap-2">
        {itens.map((item) => (
          <li
            key={item}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
