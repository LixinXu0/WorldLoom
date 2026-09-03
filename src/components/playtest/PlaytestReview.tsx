import { feedbackToSuggestions } from "../../core/playtest/feedbackToSuggestions";
import { calculatePlayedTimeline } from "../../core/timeline/calculatePlayedTimeline";
import { useWorldloomStore } from "../../store/useWorldloomStore";
import { ExperienceTimeline } from "../timeline/ExperienceTimeline";

export function PlaytestReview() {
  const { project, createEditFromSuggestion } = useWorldloomStore();
  const variant = project.variants.find((item) => item.id === (project.workingVariantId ?? project.activeVariantId)) ?? project.variants[0];
  if (!variant) return null;
  const events = project.playtestEvents.filter((event) => event.variantId === variant.id);
  const feedback = project.experienceFeedback.filter((item) => item.variantId === variant.id);
  const points = calculatePlayedTimeline(variant, events, feedback);
  return <section><h3>Playtest Review</h3><ExperienceTimeline title="Played" points={points} /><p>{events.filter((event) => event.type === "room-enter" || event.type === "branch-enter" || event.type === "session-complete").length} room entries / {feedback.length} feedback marks</p>{feedback.map((item) => { const room = variant.rooms.find((candidate) => candidate.id === item.roomId); const suggestions = feedbackToSuggestions(item, room); return <article className="feedback-item" key={item.id}><strong>{item.category}</strong><small>{room?.id ?? "unknown room"}</small>{suggestions.map((suggestion) => <button key={`${item.id}-${suggestion.property}`} onClick={() => createEditFromSuggestion(suggestion)}>{suggestion.property}: {String(suggestion.before)} ¡ú {String(suggestion.after)}</button>)}</article>; })}</section>;
}