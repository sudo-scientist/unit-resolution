// All page text lives here. NAMED_LABEL is the only place a diagnosis is named.
export const NAMED_LABEL = "autism";

const label = NAMED_LABEL.trim() || "the label";

export const ACTS = {
  I: "How meaning forms",
  II: "How minds differ",
  III: "When minds meet",
  IV: "How difference gets explained",
  V: "After the stages",
};

// control: {type: 'range'|'button'|'toggle', id, label, ends?, value?}
export const STAGES = [
  { id: "raw", act: "I", title: "Raw material" }, // text is the hero in index.html
  {
    id: "units", act: "I", title: "Units",
    body: [
      "A mind groups raw material into units: points gathered behind a boundary.",
      "Each unit is a decision that “these are the same thing.” That decision is resolution, and it gives the model its name.",
      "Merge too eagerly and different things collapse into one. Merge too little and every instance has to be handled fresh.",
    ],
    aside: "Technical readers will know this problem as entity resolution.",
    hint: "Drag a stray point toward a unit.",
    controls: [{ type: "range", id: "match", label: "Match threshold", ends: ["loose", "strict"], value: 50 }, { type: "button", id: "offer", label: "Offer a stray point" }],
  },
  {
    id: "priors", act: "I", title: "Priors",
    body: [
      "A set unit becomes an expectation, a prior. What it predicts well stops arriving.",
      "Shiloh stopped hearing the kitchen clock within a week. Maven still hears every tick months later.",
      "A strong prior can even beat the input: you can know two lines are equal and still see them as different.",
    ],
    controls: [{ type: "toggle", id: "keepopen", label: "Keep it open" }],
    figure: "illusions",
  },
  {
    id: "portability", act: "I", title: "Portability and fidelity",
    body: [
      "Units are useful because they travel between minds. How well a unit travels is its portability.",
      "Every unit drops detail in order to travel. Fidelity is how close the copy stays to what it described.",
    ],
    aside: "In engineering terms, this is lossy compression.",
    controls: [
      { type: "range", id: "compress", label: "Compression", ends: ["full detail", "compact"], value: 60 },
      { type: "button", id: "send", label: "Send the unit" },
    ],
  },
  {
    id: "words", act: "I", title: "Words", speculative: true,
    body: [
      "Words are another round of clustering, on top of units.",
      "Language may be an expression of a deeper ability, clustering experience into units that can be shared, and that ability may be what set humans apart.",
    ],
  },
  {
    id: "culture", act: "I", title: "Culture and inheritance", speculative: true,
    body: [
      "Shared units pass between people and down generations. Each new mind starts with the previous generation’s units as its priors.",
      "Humans are easily programmable, and that may be the adaptation.",
      "Culture is partly a way of finding people like you, and opinions and tastes bundle into archetypes.",
    ],
  },
  {
    id: "melt", act: "II", title: "Melting point",
    body: [
      "Minds differ in how readily things set into units and how readily units come apart again.",
      "It isn’t a single fixed number. It shifts with the subject, with the person’s state, even with medication.",
    ],
    hint: "The slider stays with you from here on.",
    controls: [
      { type: "button", id: "preset-open", label: "Stays open" },
      { type: "button", id: "preset-fast", label: "Sets fast" },
    ],
  },
  {
    id: "crossing", act: "II", title: "Crossing boundaries",
    body: [
      "Building sideways means following links that cross boundaries. Learning compounds across unrelated fields because the raw material underneath really is shared.",
      "Going “up” is treating a whole cluster as one thing, and going “down” is opening it.",
      "Some people live fluently inside the shared units and can still see them as units. A comedian takes an audience across a boundary to look back at it, then brings them home.",
    ],
    hint: "Click a unit to go up. Click again to go down.",
    controls: [{ type: "button", id: "updown", label: "Take a unit up or down" }, { type: "button", id: "stepout", label: "Step outside and look back" }],
  },
  {
    id: "ceiling", act: "II", title: "The ceiling",
    body: [
      "Staying open has a cost. Past a point, the bottleneck is holding connections, and seeing them is easy.",
      "Touch one thought and twenty others light up. Nothing settles enough to be set down.",
    ],
    hint: "Touch a unit. Then move the slider and touch again.",
    controls: [{ type: "toggle", id: "touch", label: "Touch a thought" }],
  },
  {
    id: "gap", act: "III", title: "The gap",
    body: [
      "The shared world is built from units that set fast, because those travel best.",
      "A mind that keeps more open has to translate constantly into a vocabulary shaped by someone else’s setting.",
      "That cost is paid all day, and it feels like being an alien.",
    ],
    aside: "The shared layer behaves like a codec tuned for one kind of sender.",
  },
  {
    id: "misreading", act: "III", title: "Misreading",
    body: [
      "Maven asks Shiloh to put his climbing gear away. He hears “you’re messy.” She explains, and he hears “you’re wrong about what you felt.” She tries a careful request, and he hears a lecture.",
      "Then he settles on a word for her: “sensitive.” After that, everything she says arrives through it.",
      "Neither of them is broken. The gap sits between them.",
    ],
    controls: [{ type: "button", id: "send", label: "Send" }],
    figure: "transcript",
  },
  {
    id: "labels", act: "IV", title: "Labels written from the center",
    body: [
      "A town can be said to “have remoteness.” The remoteness is real and it matters, but it’s a distance from a center, and the center does the naming.",
      `Labels for minds work the same way. A sentence like “Maven has ${label}” reports her distance from the default as a property of her.`,
      "The label is defined by a list of observed behaviors, and then it gets cited as their cause.",
    ],
    controls: [{ type: "button", id: "replay", label: "Replay" }],
  },
  {
    id: "collision", act: "IV", title: "Collision",
    body: [
      "The category is sorted by what shows on the surface. Many different minds can hit the same wall for different reasons: one never set fast to begin with, one is held open by old threat, one has attention that leaves before things set, one is flooded by sensation.",
      "From outside the impacts look alike, so they get one name.",
      "“The spectrum” may describe a collision more than a kind of mind.",
    ],
    controls: [
      { type: "toggle", id: "inside", label: "Look inside" },
      { type: "button", id: "replay", label: "Replay" },
    ],
  },
  {
    id: "sharper", act: "IV", title: "Sharper units, bigger gaps", speculative: true,
    body: [
      "The easier units are to share, the more sharply bounded they become.",
      "Sharper units leave wider gaps at their edges, and more people end up in those gaps.",
      "People compress themselves into archetypes to stay legible.",
    ],
    controls: [{ type: "range", id: "share", label: "Shareability", ends: ["low", "high"], value: 15 }],
  },
  {
    id: "change", act: "IV", title: "What can change",
    body: [
      "How a person sorts the world stays. The categories, the tests and the surroundings can change.",
      "A useful test would look for how someone sorts and what they need. Which box they fit matters less.",
    ],
    hint: "The wall is yours. The mind’s pattern stays as it is.",
    controls: [
      { type: "range", id: "slotw", label: "Slot shape", ends: ["narrow", "wide"], value: 10 },
      { type: "button", id: "addslot", label: "Add a slot" },
    ],
  },
  {
    id: "sandbox", act: "V", title: "Sandbox",
    body: ["Two minds, every control unlocked. Try to get a message across intact."],
    controls: [
      { type: "range", id: "meltA", label: "Left mind", ends: ["stays open", "sets fast"], value: 20 },
      { type: "range", id: "meltB", label: "Right mind", ends: ["stays open", "sets fast"], value: 80 },
      { type: "range", id: "match", label: "Match threshold", ends: ["loose", "strict"], value: 50 },
      { type: "range", id: "compress", label: "Compression", ends: ["full detail", "compact"], value: 50 },
      { type: "range", id: "slotw", label: "Slot shape", ends: ["narrow", "wide"], value: 30 },
      { type: "button", id: "send", label: "Send a message" },
    ],
  },
];
