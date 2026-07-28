export function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <h1 className="mb-2 font-display text-xl text-slate-900">{title}</h1>
      <p className="text-sm text-slate-500">
        Pantalla pendiente — el modelo de datos en Firestore ya está listo para esta sección.
      </p>
    </div>
  );
}
