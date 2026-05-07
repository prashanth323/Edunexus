import { Folder, FileText, ChevronRight, ChevronDown, Eye, EyeOff } from "lucide-react"
import { NodeApi } from "react-arborist"
import { cn } from "@/lib/utils"

export type CourseTreeNode = {
  id: string
  name: string
  type: "course" | "module" | "lesson" | "folder"
  isPublished?: boolean
  children?: CourseTreeNode[]
}

export function LmsTreeNode({ node, style, dragHandle }: { node: NodeApi<CourseTreeNode>; style: React.CSSProperties; dragHandle?: any }) {
  const isFolder = node.data.type === "module" || node.data.type === "folder" || node.data.type === "course"
  const Icon = isFolder ? (node.isOpen ? ChevronDown : ChevronRight) : FileText
  const TypeIcon = node.data.type === "module" ? Folder : node.data.type === "course" ? Folder : FileText

  return (
    <div
      style={style}
      ref={dragHandle}
      className={cn(
        "group flex items-center gap-2 px-2 py-1 cursor-pointer rounded-md transition-colors",
        node.isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted",
        node.level > 0 && "ml-2"
      )}
      onClick={() => node.select()}
    >
      <div className="flex items-center gap-1 min-w-0 flex-1">
        {isFolder && (
          <span
            className="p-0.5 hover:bg-primary/20 rounded-sm"
            onClick={(e) => {
              e.stopPropagation()
              node.toggle()
            }}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
          </span>
        )}
        {!isFolder && <div className="w-4.5" />}
        <TypeIcon className={cn("h-4 w-4 shrink-0", node.data.type === "module" ? "text-blue-500" : "text-muted-foreground")} />
        <span className="truncate text-sm font-medium">{node.data.name}</span>
      </div>
      
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {node.data.isPublished !== undefined && (
          node.data.isPublished ? (
            <span title="Published"><Eye className="h-3 w-3 text-green-500" /></span>
          ) : (
            <span title="Draft"><EyeOff className="h-3 w-3 text-muted-foreground" /></span>
          )
        )}
      </div>
    </div>
  )
}
