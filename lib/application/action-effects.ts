import { AsyncLocalStorage } from "node:async_hooks";

export type ActionRevalidationType = "layout" | "page";

export type ActionEffects = {
  revalidatePath(path: string, type?: ActionRevalidationType): void;
  redirect(path: string): never;
};

const actionEffectsStorage = new AsyncLocalStorage<ActionEffects>();

export function withActionEffects<T>(effects: ActionEffects, operation: () => Promise<T>): Promise<T> {
  return actionEffectsStorage.run(effects, operation);
}

export function invalidateActionPath(path: string, type?: ActionRevalidationType): void {
  const effects = actionEffectsStorage.getStore();
  if (!effects) throw new Error("ACTION_EFFECTS_CONTEXT_REQUIRED");
  effects.revalidatePath(path, type);
}

export function navigateAction(path: string): never {
  const effects = actionEffectsStorage.getStore();
  if (!effects) throw new Error("ACTION_EFFECTS_CONTEXT_REQUIRED");
  return effects.redirect(path);
}
