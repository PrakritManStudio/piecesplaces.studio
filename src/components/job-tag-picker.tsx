"use client";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type TagOption = {
  id: string;
  name: string;
  color: string | null;
};

export function TagBadge(props: { name: string; color?: string | null; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-normal", props.className)}
      style={
        props.color
          ? { borderColor: props.color, color: props.color }
          : undefined
      }
    >
      {props.name}
    </Badge>
  );
}

export function JobTagPicker(props: {
  options: TagOption[];
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  if (props.options.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        ยังไม่มี tag — เพิ่มได้ที่ตั้งค่า (admin)
      </p>
    );
  }

  function toggle(id: string) {
    if (props.value.includes(id)) {
      props.onChange(props.value.filter((x) => x !== id));
    } else {
      props.onChange([...props.value, id]);
    }
  }

  return (
    <div className={cn("flex flex-wrap gap-2", props.className)}>
      {props.options.map((tag) => {
        const checked = props.value.includes(tag.id);
        return (
          <label
            key={tag.id}
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm transition-colors",
              checked ? "bg-muted" : "bg-background hover:bg-muted/50",
            )}
          >
            <Checkbox
              checked={checked}
              onCheckedChange={() => toggle(tag.id)}
              aria-label={tag.name}
            />
            <TagBadge name={tag.name} color={tag.color} />
          </label>
        );
      })}
    </div>
  );
}
