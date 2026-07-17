declare namespace JSX {
  interface IntrinsicElements {
    "elevenlabs-convai": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      "agent-id"?: string;
      variant?: string;
      placement?: string;
      "avatar-image-url"?: string;
      "text-input"?: string;
      "default-expanded"?: string;
      "dynamic-variables"?: string;
    };
  }
}
