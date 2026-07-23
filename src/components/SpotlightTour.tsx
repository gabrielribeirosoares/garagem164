import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Compass,
  Zap
} from "lucide-react";

export interface SpotlightStep {
  targetSelector: string; // e.g. '[data-tour="admin-rifa-create"]'
  title: string;
  description: string;
  badge?: string;
  position?: "top" | "bottom" | "left" | "right" | "auto";
}

interface SpotlightTourProps {
  steps: SpotlightStep[];
  isOpen: boolean;
  onClose: () => void;
  tourKey: string; // e.g. "admin-rifas-tour"
}

export function SpotlightTour({
  steps,
  isOpen,
  onClose,
  tourKey,
}: SpotlightTourProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const currentStep = steps[currentStepIndex];

  const updatePosition = () => {
    if (!isOpen || !currentStep) return;
    const el = document.querySelector(currentStep.targetSelector);
    if (el) {
      // Scroll target element into view smoothly if off-screen
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

      const rect = el.getBoundingClientRect();
      setTargetRect(rect);

      // Compute tooltip position
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let top = rect.bottom + 12;
      let left = rect.left + rect.width / 2 - 160;

      // Adjust if off-screen vertically
      if (top + 220 > viewportHeight) {
        top = Math.max(16, rect.top - 230);
      }

      // Adjust if off-screen horizontally
      if (left + 320 > viewportWidth - 16) {
        left = viewportWidth - 336;
      }
      if (left < 16) {
        left = 16;
      }

      setTooltipPos({ top, left });
    } else {
      setTargetRect(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
    }
  }, [isOpen, tourKey]);

  useEffect(() => {
    if (!isOpen) return;

    // Small delay to ensure DOM is fully rendered
    const timer = setTimeout(updatePosition, 300);

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, currentStepIndex, currentStep?.targetSelector]);

  if (!isOpen || !currentStep) return null;

  const isLastStep = currentStepIndex === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(`hw_tour_${tourKey}`, "true");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto">
      {/* Backdrop with SVG cutout for target element */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none transition-all duration-300">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - 6}
                y={targetRect.top - 6}
                width={targetRect.width + 12}
                height={targetRect.height + 12}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.75)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Target Element Pulsing Highlight Box */}
      {targetRect && (
        <div
          className="fixed pointer-events-none border-2 border-primary rounded-2xl animate-pulse shadow-[0_0_25px_rgba(249,115,22,0.6)] transition-all duration-300 z-50"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}

      {/* Tooltip Card */}
      <div
        className="fixed z-50 w-[320px] md:w-[360px] bg-card border border-border text-foreground p-5 rounded-2xl shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200"
        style={{
          top: targetRect ? tooltipPos.top : "50%",
          left: targetRect ? tooltipPos.left : "50%",
          transform: targetRect ? "none" : "translate(-50%, -50%)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold uppercase tracking-wider">
              <Compass className="h-3 w-3 mr-1 animate-spin" /> Passo {currentStepIndex + 1} de {steps.length}
            </Badge>
            <h3 className="font-black text-base text-foreground flex items-center gap-1.5">
              {currentStep.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Fechar guia"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <p className="text-xs text-muted-foreground leading-relaxed font-medium">
          {currentStep.description}
        </p>

        {/* Footer controls */}
        <div className="flex items-center justify-between pt-2 border-t border-border/60">
          <div className="flex items-center gap-1">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentStepIndex ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentStepIndex > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrev}
                className="h-8 px-2.5 text-xs font-bold border-border"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Anterior
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleNext}
              className="h-8 px-3 text-xs font-bold hw-gradient-orange text-white"
            >
              {isLastStep ? (
                <>
                  <Sparkles className="h-3.5 w-3.5 mr-1" /> Concluir
                </>
              ) : (
                <>
                  Próximo <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
