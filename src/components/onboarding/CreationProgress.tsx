import { useWorldloomStore } from "../../store/useWorldloomStore";

export function CreationProgress() {
  const { project, loadExample, dismissOnboarding, onboardingDismissed } = useWorldloomStore();
  if (onboardingDismissed) return null;
  const steps = [
    { label: "Draw the main flow", done: project.strokes.some((stroke) => stroke.type === "flow") },
    { label: "Add pressure and relief", done: project.strokes.some((stroke) => stroke.type === "pressure") && project.strokes.some((stroke) => stroke.type === "relief") },
    { label: "Review interpretation", done: project.constraints.length > 0 },
    { label: "Generate alternatives", done: project.variants.length > 0 },
    { label: "Choose a working variant", done: Boolean(project.workingVariantId) },
    { label: "Edit or playtest", done: project.editHistory.length > 0 || project.playtestEvents.length > 0 },
  ];
  return <div className="progress-strip"><strong>Design a short experience</strong>{steps.map((step) => <span key={step.label} className={step.done ? "done" : ""}>{step.label}</span>)}<button onClick={loadExample}>Start with Example</button><button onClick={dismissOnboarding}>Dismiss</button></div>;
}