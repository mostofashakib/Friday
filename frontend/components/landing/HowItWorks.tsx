const steps = [
  {
    step: "01",
    title: "Choose your interview",
    description:
      "Select behavioral, technical, or a custom role-based interview. Set the starting difficulty from entry-level to staff engineer.",
  },
  {
    step: "02",
    title: "Answer out loud",
    description:
      "Friday asks questions and listens to your voice responses. Speak naturally — just like you would in a real interview. Text input is also supported.",
  },
  {
    step: "03",
    title: "Get coached in real time",
    description:
      "After each answer, receive an instant score, detailed feedback, and a coaching tip. Friday adapts the next question based on your competency gaps.",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-20 px-4 bg-muted/30" id="how-it-works">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            How Friday works
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            A three-step loop that mirrors real interviews and makes you better every session.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div key={step.step} className="relative">
              <div className="text-6xl font-bold text-primary/10 mb-4">{step.step}</div>
              <h3 className="font-semibold text-xl mb-3">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
