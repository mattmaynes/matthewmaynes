/**
 * Tracked, scrubbed resume data - the single source the /resume page and the
 * generated PDF both render from.
 *
 * PRIVACY BY CONSTRUCTION: this file is the public, committed derivative of the
 * private master in git-ignored `context/resume.md`. It deliberately omits all
 * PII - no phone, email, street address, or postal code. Location is region
 * only ("Ontario, Canada"). See AGENTS.md ("Public repo - strip PII").
 *
 * Editing this file (or the resume page / print styles) means the committed
 * `public/resume.pdf` is stale: run `npm run resume:pdf` and commit the result.
 */

export type LeadershipPrinciple = { lead: string; body: string };
export type ToolGroup = { label: string; items: string };
export type WorkEntry = {
  title: string;
  company: string;
  location: string;
  period: string;
  bullets: string[];
};
export type Certification = { date: string; name: string };
export type Education = {
  degree: string;
  school: string;
  location: string;
  period: string;
};

export type Resume = {
  summary: string;
  leadership: LeadershipPrinciple[];
  skills: string[];
  tools: ToolGroup[];
  work: WorkEntry[];
  certifications: Certification[];
  education: Education[];
};

export const resume: Resume = {
  summary:
    "Full-stack engineering leader with a product-engineering mindset. Hands-on, AI-enabled, and customer-obsessed. I solve problems by bringing the right people and technology together, default to action, and lead from the details whether I'm managing or building.",

  leadership: [
    {
      lead: "Customer-obsessed.",
      body: "Driving customer value is the mission; everything else serves it.",
    },
    {
      lead: "Default to action.",
      body: "I lead hands-on and in the details, and I follow through to deliver results.",
    },
    {
      lead: "Empower with accountability.",
      body: "I give teams and leaders ownership of their outcomes while providing support, clarity, and accountability.",
    },
    {
      lead: "Grow people directly.",
      body: "Specific, timely feedback: celebrate wins in public, give constructive feedback in private.",
    },
    {
      lead: "Own it as a team.",
      body: "We celebrate wins together; I take responsibility for the failures.",
    },
    {
      lead: "Titles don't make leaders, people do.",
      body: "Whether managing or contributing, I'm always leading.",
    },
  ],

  skills: [
    "Full-Stack & Product Engineering Leadership",
    "Org Building & Team Development",
    "Strategic Planning & Roadmapping",
    "Training, Mentoring & Direct Feedback",
    "AI-Enabled Engineering",
    "Software Design & Development",
  ],

  tools: [
    {
      label: "Languages",
      items: "Python, C/C++, Java, JavaScript/TypeScript, q/kdb+",
    },
    {
      label: "AI",
      items: "Claude, Codex, Gemini, LLM integrations, agentic applications",
    },
    { label: "Frontend", items: "Next.js, React, Tailwind CSS, Angular" },
    {
      label: "Backend & APIs",
      items: "Quarkus, API gateway design, domain-driven versioning",
    },
    {
      label: "Infrastructure",
      items: "Docker, Kubernetes, Amazon EKS, Helm, Terraform, Argo CD",
    },
    {
      label: "Observability",
      items: "Grafana, Prometheus, OpenTelemetry, ClickHouse",
    },
    {
      label: "Streaming/Messaging",
      items: "Kafka, MQTT, Kinesis, Google Pub/Sub",
    },
    { label: "Analytics", items: "Google Analytics, Tealium, Pendo" },
    { label: "Tooling", items: "Git, Shell, JIRA, Aha!" },
  ],

  work: [
    {
      title: "Engineering Director",
      company: "Constant Contact",
      location: "Remote, ON",
      period: "2025-05 - Current",
      bullets: [
        "Led 36 engineers across 7 teams spanning two organizational pillars: Product-Led Growth and Emerging Growth.",
        "Product-Led Growth: drove product experimentation (Arcanine, Orion) to raise activation and conversion rates, plus an AI Infrastructure team delivering AI-driven conversion features such as AI-generated emails and content.",
        "Emerging Growth: oversaw a zero-to-one, AI-powered agentic social media management tool (ctct.social) now serving paying customers at a 20% trial-to-paid conversion rate, a new events-hosting product, and core social platform stability.",
        "Sustained the delivery-velocity gains from the Rise initiative and owned the public-facing marketing site (Front-of-Site).",
      ],
    },
    {
      title: "Senior Engineering Manager",
      company: "Constant Contact",
      location: "Remote, ON",
      period: "2024-02 - 2025-05",
      bullets: [
        "Led 3 teams (Core Platform, Rise, and User Intent) through a full UI and infrastructure modernization.",
        "Stood up a new Amazon EKS cluster managed with Terraform, using Argo CD for application deployment.",
        "Rebuilt the UI in Next.js, TypeScript, React, and Tailwind CSS, establishing a new design system and rebuilding the entire custom AdTech interface.",
        "Delivered a new API gateway in Java/Quarkus, modernizing and versioning the Constant Contact API with domain consistency.",
        "Improved page load time from 800ms to 200ms and Lighthouse scores from ~30 to 80+.",
        "Accelerated deployment cadence from once every two weeks to twice per day, a 20x improvement in one year.",
        "Led Intent-Based Onboarding: a streamlined flow that tailors the experience to each user's stated intent (or an import from their website), paired with a new dashboard and contacts experience.",
      ],
    },
    {
      title: "VP Real-Time Analytics",
      company: "KX",
      location: "Remote, ON",
      period: "2023-08 - 2024-02",
      bullets: [
        "Led 6 engineering teams architecting and delivering kdb Insights and kdb Insights Enterprise, cloud-native distributed systems on Docker and Kubernetes.",
        "Delivered a highly available, real-time platform with cross-zone redundancy, data encryption, and data entitlements.",
        "Optimized cross-team communication with feature ceremonies and dedicated channels, breaking down silos and enabling collaboration.",
        "Built the foundations of KDB.AI, a time-series vector database enabling machine learning and LLM workloads.",
      ],
    },
    {
      title: "Engineering Manager",
      company: "KX",
      location: "Kanata, ON",
      period: "2020-08 - 2023-08",
      bullets: [
        "Led 2 teams building kdb Insights Stream Processor, a low-latency, high-throughput stream processing system.",
        "Drove full-stack development across q/kdb+, C, Python, Java, and TypeScript with Angular.",
        "Focused on high-impact delivery by prioritizing customer needs while balancing technical requirements.",
        "Empowered the team with dedicated learning time and coached individual contributors into scrum master roles.",
      ],
    },
    {
      title: "Senior Software Engineer",
      company: "KX",
      location: "Kanata, ON",
      period: "2015-08 - 2020-08",
      bullets: [
        "Led a team building a data transformation platform in q/kdb+, C, Python, JavaScript, and TypeScript.",
        "Built 60+ operators for a no-code/low-code data pipeline builder web application.",
        "Designed and developed the data importer/exporter for KX Analyst.",
        "Mentored junior developers and interns.",
      ],
    },
    {
      title: "Software Developer",
      company: "Bedarra Research Labs",
      location: "Kanata, ON",
      period: "2015-01 - 2015-08",
      bullets: [
        "Built KX Analyst, a data-analytics toolkit, IDE, and ETL tool for q/kdb+, developed in JavaScript, C, q/kdb+, and Python.",
        "Implemented user authentication using SAML SSO.",
      ],
    },
    {
      title: "Software Developer",
      company: "Team Eagle",
      location: "Campbellford, ON",
      period: "2013-05 - 2014-02",
      bullets: [
        "Developed Eagle SNAP, an iOS app (Objective-C, Xcode) for submitting NOTAMJs to Nav Canada from an iPad.",
        "Integrated SOAP web services to submit reports. NOTAMJs are real-time safety notices issued by airport inspectors to alert pilots of environmental conditions.",
      ],
    },
  ],

  certifications: [
    { date: "2022-03", name: "Agile Project Leadership" },
    { date: "2022-03", name: "How to be an Effective Remote Manager" },
    { date: "2019-03", name: "Machine Learning Engineer Nanodegree" },
  ],

  education: [
    {
      degree: "Bachelor's of Engineering: Software Engineering",
      school: "Carleton University",
      location: "Ottawa, ON",
      period: "2012-09 - 2017-04",
    },
  ],
};
