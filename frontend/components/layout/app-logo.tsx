import Image from "next/image";

type AppLogoProps = {
  className?: string;
  size?: number;
  priority?: boolean;
};

export function AppLogo({ className, size = 32, priority = false }: AppLogoProps) {
  return (
    <Image
      src="/assets/logo.png"
      alt="GrayMatter"
      width={size}
      height={size}
      className={className}
      priority={priority}
    />
  );
}
