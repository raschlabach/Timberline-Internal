"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (value: string) => void
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, onSearch, value, defaultValue, ...props }, ref) => {
    // Using internal state to control the input
    const [searchValue, setSearchValue] = React.useState(value || defaultValue || "")
    
    // Update internal state when value prop changes
    React.useEffect(() => {
      console.log("SearchInput received value prop:", value)
      if (value !== undefined) {
        setSearchValue(value)
      }
    }, [value])
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      console.log("SearchInput input changed:", newValue)
      setSearchValue(newValue)
      
      if (onSearch) {
        console.log("SearchInput calling onSearch with:", newValue)
        onSearch(newValue)
      }
    }

    return (
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 pl-10 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          onChange={handleChange}
          value={searchValue}
          ref={ref}
          {...props}
        />
      </div>
    )
  }
)
SearchInput.displayName = "SearchInput"

export { SearchInput } 