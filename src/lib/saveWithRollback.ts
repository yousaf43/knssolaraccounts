/** Compensate completed stock writes when the document write fails. */
export async function saveWithRollback(
  changes: { apply: () => Promise<void>; undo: () => Promise<void> }[],
  save: () => Promise<void>,
) {
  const completed: typeof changes = [];
  try {
    for (const change of changes) {
      await change.apply();
      completed.push(change);
    }
    await save();
  } catch (error) {
    const rollback = await Promise.allSettled(completed.reverse().map(change => change.undo()));
    if (rollback.some(result => result.status === "rejected")) {
      throw new Error("Invoice was not saved and stock could not be fully restored. Check inventory before retrying.");
    }
    throw error;
  }
}