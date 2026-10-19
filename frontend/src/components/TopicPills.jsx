import React from "react";

const TOPICS = [
  { id: "all", label: "All Posts", icon: "auto_awesome" },
  { id: "Tech", label: "Tech", icon: "terminal" },
  { id: "Academic", label: "Academic", icon: "school" },
  { id: "Career", label: "Career", icon: "work" },
  { id: "Life", label: "Life", icon: "nature_people" },
];

export default function TopicPills({ activeTopic = "all", onSelectTopic }) {
  return (
    <section className="overflow-x-auto no-scrollbar py-2 -mx-4 px-4 sm:mx-0 sm:px-0">
      <div className="flex items-center gap-2.5 whitespace-nowrap">
        {TOPICS.map((topic) => {
          const isSelected =
            activeTopic.toLowerCase() === topic.id.toLowerCase();
          return (
            <button
              key={topic.id}
              onClick={() => onSelectTopic(topic.id)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 active:scale-95 flex items-center gap-2 shadow-sm ${
                isSelected
                  ? "bg-primary text-on-primary shadow-primary/20 scale-[1.02]"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              <span className="material-symbols-outlined text-lg">
                {topic.icon}
              </span>
              {topic.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
