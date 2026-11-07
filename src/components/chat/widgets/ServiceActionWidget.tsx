/** @doc The universal service widget.
 *
 *  Every connected service — all 586 of them, and anything added later — gets a
 *  clean glass card from this one component: who ran, what it ran, the real
 *  result, and what the user can do next. No per-service code required.
 */
import {
  GlassWidget,
  WidgetActions,
  WidgetBadge,
  WidgetBody,
  WidgetButton,
  WidgetEmpty,
  WidgetError,
  WidgetField,
  WidgetHead,
  WidgetMark,
  WidgetSkeleton,
  WidgetTable,
} from "./GlassWidget";

export type ServiceResult = { columns: string[]; rows: string[][] } | { text: string } | null;

export interface ServiceAction {
  service: string;
  logo?: string;
  action: string;
  summary?: string;
  status: "running" | "done" | "error";
  fields?: { label: string; value?: string }[];
  result?: ServiceResult;
  count?: number;
  ms?: number;
  error?: string;
  url?: string;
}

const isTable = (r: ServiceResult): r is { columns: string[]; rows: string[][] } =>
  !!r && "columns" in r && Array.isArray((r as any).columns);

export default function ServiceActionWidget({
  data,
  onSend,
}: {
  data: ServiceAction;
  onSend: (text: string) => void;
}) {
  const badge =
    data.status === "running" ? (
      <WidgetBadge tone="muted">Running</WidgetBadge>
    ) : data.status === "error" ? (
      <WidgetBadge tone="bad">Failed</WidgetBadge>
    ) : (
      <WidgetBadge tone="ok">Done</WidgetBadge>
    );

  const meta = [
    data.count != null ? `${data.count} result${data.count === 1 ? "" : "s"}` : null,
    data.ms != null ? `${(data.ms / 1000).toFixed(1)}s` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <GlassWidget className="max-w-[560px]">
      <WidgetHead
        mark={<WidgetMark src={data.logo} alt={data.service} />}
        title={data.service}
        subtitle={data.action}
        badge={badge}
      />

      {data.status === "running" && <WidgetSkeleton lines={2} />}

      {data.status === "error" && (
        <div className="px-4 py-3">
          <WidgetError text={data.error || `${data.service} could not finish this action.`} />
        </div>
      )}

      {data.status === "done" && (
        <>
          <WidgetBody>
            <div className="flex flex-col gap-2.5">
              {data.summary && (
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">{data.summary}</p>
              )}

              {!!data.fields?.length && (
                <div className="rounded-[14px] border border-white/10 bg-white/[0.04] px-3 py-1.5">
                  {data.fields.map((f, i) => (
                    <WidgetField key={`${f.label}-${i}`} label={f.label} value={f.value ?? "—"} />
                  ))}
                </div>
              )}

              {isTable(data.result) ? (
                <WidgetTable columns={data.result.columns} rows={data.result.rows} />
              ) : data.result && "text" in data.result && data.result.text ? (
                <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap rounded-[14px] border border-white/10 bg-white/[0.04] px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-foreground/85">
                  {data.result.text}
                </pre>
              ) : !data.summary && !data.fields?.length ? (
                <WidgetEmpty text={`${data.service} finished this action.`} />
              ) : null}
            </div>
          </WidgetBody>

          <WidgetActions>
            <WidgetButton
              variant="primary"
              onClick={() => onSend(`Show me the full details of that ${data.service} result.`)}
            >
              Full details
            </WidgetButton>
            {data.url && (
              <WidgetButton onClick={() => window.open(data.url, "_blank", "noopener")}>Open in {data.service}</WidgetButton>
            )}
            <WidgetButton onClick={() => onSend(`Run that ${data.service} action again.`)}>Run again</WidgetButton>
          </WidgetActions>
        </>
      )}

      {data.status === "done" && meta && (
        <p className="px-4 pb-3 text-[11.5px] text-muted-foreground/80">{meta}</p>
      )}
    </GlassWidget>
  );
}
