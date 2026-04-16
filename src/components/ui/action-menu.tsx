import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface ActionMenuItem {
  label: string;
  onSelect: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
  destructive?: boolean;
  separatorBefore?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  align?: 'start' | 'center' | 'end';
  title?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  alwaysVisible?: boolean;
}

export default function ActionMenu({
  items,
  align = 'end',
  title = 'Acoes',
  className,
  triggerClassName,
  contentClassName,
  alwaysVisible = false,
}: ActionMenuProps) {
  const visibleItems = items.filter((item) => item != null);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className={cn(
            'h-7 w-7 shrink-0',
            !alwaysVisible && 'opacity-0 transition-opacity group-hover:opacity-100',
            triggerClassName
          )}
          title={title}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className={cn('min-w-44', className, contentClassName)}
        onClick={(event) => event.stopPropagation()}
      >
        {visibleItems.map((item, index) => {
          const Icon = item.icon;

          return (
            <div key={`${item.label}-${index}`}>
              {item.separatorBefore && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={item.disabled}
                className={cn(item.destructive && 'text-destructive focus:text-destructive')}
                onSelect={item.onSelect}
              >
                {Icon && <Icon className="mr-2 h-4 w-4" />}
                {item.label}
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
