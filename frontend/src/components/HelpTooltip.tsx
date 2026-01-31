import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Tooltip,
} from "@heroui/react";
import { CircleHelp } from "lucide-react";

export interface HelpTooltipProps {
  /** Brief description of what the chart visualizes */
  description: string;
  /** List of interaction hints with icons */
  interactions?: { icon: string; text: string }[];
  /** Title of the chart */
  title: string;
}

export function HelpTooltip({
  description,
  interactions = [],
  title,
}: HelpTooltipProps): React.ReactElement {
  return (
    <Tooltip
      classNames={{ content: "p-0 bg-transparent border-0 shadow-none" }}
      content={
        <Card className="bg-black/80 backdrop-blur-xl border border-white/10 max-w-[280px] shadow-xl shadow-purple-500/5">
          <CardHeader className="pb-2 pt-3 px-4 flex-col items-start gap-1">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-gradient-to-b from-purple-500 to-pink-500" />
              <h4 className="text-sm font-semibold text-white">{title}</h4>
            </div>
          </CardHeader>
          <CardBody className="pt-0 pb-3 px-4">
            <p className="text-xs text-gray-400 leading-relaxed mb-3">
              {description}
            </p>
            {interactions.length > 0 && (
              <>
                <Divider className="bg-white/10 mb-2" />
                <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Interactions
                </p>
                <div className="space-y-1.5">
                  {interactions.map((hint, i) => (
                    <div
                      className="flex items-center gap-2.5 text-[11px]"
                      key={i}
                    >
                      <span className="text-sm w-5 text-center opacity-70">
                        {hint.icon}
                      </span>
                      <span className="text-gray-300">{hint.text}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      }
      delay={200}
      offset={10}
      placement="bottom-end"
    >
      <Button
        aria-label={`Help: ${title}`}
        isIconOnly
        size="sm"
        variant="ghost"
      >
        <CircleHelp className="w-4 h-4" />
      </Button>
    </Tooltip>
  );
}
