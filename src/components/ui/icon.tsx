import {
  LayoutDashboard, CalendarDays, ListChecks, Users, FolderKanban, Boxes, ScanSearch, Store,
  FlaskConical, ClipboardList, Palette, LayoutGrid, TestTube, ShieldCheck, GanttChart,
  MessagesSquare, Contact, Factory, Package, Brush, Cog, Atom, Sparkles, Flower2, Tags,
  BadgeCheck, TrendingUp, Target, Receipt, Scale, FileDown, FileBarChart, FileText, History,
  Settings, FileSpreadsheet, FormInput, CalendarRange, FileType, Blocks, Wand2, Plug,
  LockKeyhole, Circle, CheckCircle2, AlarmClock, PackageOpen, Layers, Gem, Droplet, Leaf, Heart,
  Star, Beaker, Microscope, Lightbulb, Briefcase, BookOpen, Flag,
  Eye, EyeOff, Trash2, Paperclip, Pencil, Copy, Archive, ArchiveRestore, Plus, Check, X, ExternalLink, Mail, Phone, Globe, MapPin, Building2, CalendarClock, Clock, ArrowUp, ArrowDown, RotateCcw, Pause, Play, Milestone, Hourglass, MessageCircle, Upload, Download, Filter, Info, AlertTriangle, MoreHorizontal, Undo2, type LucideIcon,
} from "lucide-react";

/** Ícones disponíveis para módulos (sistema e personalizados). Nomes salvos no banco. */
export const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, CalendarDays, ListChecks, Users, FolderKanban, Boxes, ScanSearch, Store,
  FlaskConical, ClipboardList, Palette, LayoutGrid, TestTube, ShieldCheck, GanttChart,
  MessagesSquare, Contact, Factory, Package, Brush, Cog, Atom, Sparkles, Flower2, Tags,
  BadgeCheck, TrendingUp, Target, Receipt, Scale, FileDown, FileBarChart, FileText, History,
  Settings, FileSpreadsheet, FormInput, CalendarRange, FileType, Blocks, Wand2, Plug,
  LockKeyhole, Circle, CheckCircle2, AlarmClock, PackageOpen, Layers, Gem, Droplet, Leaf, Heart,
  Star, Beaker, Microscope, Lightbulb, Briefcase, BookOpen, Flag,
  Eye, EyeOff, Trash2, Paperclip, Pencil, Copy, Archive, ArchiveRestore, Plus, Check, X, ExternalLink, Mail, Phone, Globe, MapPin, Building2, CalendarClock, Clock, ArrowUp, ArrowDown, RotateCcw, Pause, Play, Milestone, Hourglass, MessageCircle, Upload, Download, Filter, Info, AlertTriangle, MoreHorizontal, Undo2,
};

export const ICON_CHOICES = [
  "Sparkles", "Flower2", "Droplet", "Gem", "Heart", "Leaf", "Star", "Beaker", "Microscope",
  "FlaskConical", "TestTube", "Atom", "Palette", "Brush", "Package", "PackageOpen", "Boxes",
  "Layers", "Tags", "BadgeCheck", "ShieldCheck", "Target", "TrendingUp", "Receipt", "Scale",
  "Factory", "Store", "Contact", "Users", "Briefcase", "ClipboardList", "ListChecks",
  "CalendarDays", "FileText", "BookOpen", "Lightbulb", "Flag", "Blocks",
];

export function Icon({
  name,
  className,
  size = 18,
  strokeWidth = 1.6,
}: {
  name: string;
  className?: string;
  size?: number;
  strokeWidth?: number;
}) {
  const Cmp = ICONS[name] ?? Circle;
  return <Cmp className={className} size={size} strokeWidth={strokeWidth} aria-hidden />;
}
