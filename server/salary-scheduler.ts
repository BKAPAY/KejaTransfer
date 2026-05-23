import { storage } from "./storage";

function computeNextPayAt(scheduleType: string, scheduleValue: number, fromDate: Date): Date {
  const now = new Date(fromDate);
  if (scheduleType === "monthly_day") {
    const day = Math.max(1, Math.min(28, scheduleValue));
    let candidate = new Date(now.getFullYear(), now.getMonth(), day, 9, 0, 0, 0);
    if (candidate <= now) {
      candidate = new Date(now.getFullYear(), now.getMonth() + 1, day, 9, 0, 0, 0);
    }
    return candidate;
  }
  const minutes = Math.max(1, scheduleValue);
  return new Date(now.getTime() + minutes * 60 * 1000);
}

export function computeInitialNextPayAt(scheduleType: string, scheduleValue: number): Date {
  return computeNextPayAt(scheduleType, scheduleValue, new Date());
}

async function processDueSchedules() {
  try {
    const dueSchedules = await storage.getAllActiveSalarySchedulesDue();
    for (const schedule of dueSchedules) {
      if (!schedule.user) continue;
      const salaryAccount = await storage.getSalaryAccount(schedule.userId);
      if (!salaryAccount || !salaryAccount.isActive) continue;

      try {
        await storage.creditSalaryBalance(schedule.userId, schedule.amount);
        await storage.createSalaryTransaction({
          userId: schedule.userId,
          type: "credit",
          amount: schedule.amount,
          currency: salaryAccount.currency,
          status: "completed",
          description: schedule.label || "Versement automatique de salaire",
        });

        const nextPayAt = computeNextPayAt(schedule.scheduleType, schedule.scheduleValue, new Date());
        await storage.updateSalarySchedule(schedule.id, {
          lastPaidAt: new Date(),
          nextPayAt,
        });

        console.log(`[SalaryScheduler] Versement ${schedule.amount} ${salaryAccount.currency} → ${schedule.userId} (schedule ${schedule.id}). Prochain: ${nextPayAt.toISOString()}`);
      } catch (err) {
        console.error(`[SalaryScheduler] Erreur versement schedule ${schedule.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[SalaryScheduler] Erreur générale:", err);
  }
}

let schedulerInterval: NodeJS.Timeout | null = null;

export function startSalaryScheduler() {
  if (schedulerInterval) return;
  console.log("[SalaryScheduler] Démarrage du planificateur de salaires (intervalle: 60s)");
  schedulerInterval = setInterval(processDueSchedules, 60 * 1000);
  processDueSchedules();
}

export function stopSalaryScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
