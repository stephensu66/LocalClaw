export async function pickDirectory(): Promise<string | null> {
  const w = window as any;
  if (typeof w.showDirectoryPicker === 'function') {
    const handle = await w.showDirectoryPicker();
    if (handle?.name) {
      return `~/` + handle.name;
    }
  }
  return null;
}
