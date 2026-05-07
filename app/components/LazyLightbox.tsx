import { lazy, Suspense, type ComponentProps } from "react";
import "yet-another-react-lightbox/styles.css";
import type LightboxImport from "yet-another-react-lightbox";

const Lightbox = lazy(() => import("yet-another-react-lightbox"));

type LightboxProps = ComponentProps<typeof LightboxImport>;

export default function LazyLightbox(props: LightboxProps) {
  if (!props.open) return null;
  return (
    <Suspense fallback={null}>
      <Lightbox {...props} />
    </Suspense>
  );
}
