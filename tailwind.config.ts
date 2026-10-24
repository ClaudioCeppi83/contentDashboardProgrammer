import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // Estados FSM del Dashboard Social Ops
        status: {
          idea: "hsl(var(--status-idea))",
          in_progress: "hsl(var(--status-in-progress))",
          in_review: "hsl(var(--status-in-review))",
          changes_requested: "hsl(var(--status-changes-requested))",
          approved: "hsl(var(--status-approved))",
          scheduled: "hsl(var(--status-scheduled))",
          publishing: "hsl(var(--status-publishing))",
          published: "hsl(var(--status-published))",
          failed: "hsl(var(--status-failed))",
        },
      },
      fontSize: {
        "display-lg": "var(--font-display-lg)",
        "headline-lg": "var(--font-headline-lg)",
        "headline-md": "var(--font-headline-md)",
        "headline-sm": "var(--font-headline-sm)",
        "body-lg": "var(--font-body-lg)",
        "body-md": "var(--font-body-md)",
        "body-sm": "var(--font-body-sm)",
        "mono-md": "var(--font-mono-md)",
        "mono-sm": "var(--font-mono-sm)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      aspectRatio: {
        "instagram-feed-square": "1 / 1",
        "instagram-feed-portrait": "4 / 5",
        "instagram-reel": "9 / 16",
      },
    },
  },
  plugins: [],
};

export default config;
