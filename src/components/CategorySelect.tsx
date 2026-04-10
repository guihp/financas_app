import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Drawer,
    DrawerContent,
    DrawerTrigger,
} from "@/components/ui/drawer";
import { getCategoriesByType, getCategoryGroupsByType, FIXED_CATEGORIES } from "@/constants/financialData";
import { useIsMobile } from "@/hooks/use-mobile";

interface CategorySelectProps {
    value: string;
    onValueChange: (value: string) => void;
    type: "income" | "expense";
    categories: any[];
    /** Valores de FIXED_CATEGORIES a ocultar (ex.: `hidden_fixed_subcats` da página Categorias) */
    excludeFixedCategoryValues?: string[];
}

export function CategorySelect({ value, onValueChange, type, categories, excludeFixedCategoryValues }: CategorySelectProps) {
    const [open, setOpen] = useState(false);
    const isMobile = useIsMobile();

    const filteredGroups = getCategoryGroupsByType(type);
    const filteredCategories = getCategoriesByType(type);

    // Helper to find the label of the selected category
    const getSelectedLabel = () => {
        if (!value) return "Selecione uma categoria";

        // Check fixed categories first
        const fixed = Object.values(FIXED_CATEGORIES).flat().find(c => c.value === value);
        if (fixed) return `${fixed.emoji || ""} ${fixed.label}`.trim();

        // Check user categories
        const userCat = categories.find(c => c.name === value);
        if (userCat) return userCat.name.charAt(0).toUpperCase() + userCat.name.slice(1);

        return value.charAt(0).toUpperCase() + value.slice(1);
    };

    const CommandContent = () => (
        <Command>
            <CommandInput placeholder="Buscar categoria..." />
            <CommandList>
                <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>

                {filteredGroups.map(group => {
                    const fixedCats = filteredCategories
                        .filter(c => c.group === group)
                        .filter(c => !excludeFixedCategoryValues?.includes(c.value));
                    // Custom categories that have parent_id matching this group (case insensitive)
                    const customCats = categories.filter(c => c.parent_id?.toLowerCase() === group.toLowerCase());

                    if (fixedCats.length === 0 && customCats.length === 0) return null;

                    return (
                        <CommandGroup key={group} heading={group}>
                            {fixedCats.map(cat => (
                                <CommandItem
                                    key={cat.value}
                                    value={cat.label} // Set value as label to allow user to search by natural name
                                    onSelect={() => {
                                        onValueChange(cat.value);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === cat.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {cat.emoji} {cat.label}
                                </CommandItem>
                            ))}

                            {customCats.map(cat => (
                                <CommandItem
                                    key={cat.id}
                                    value={cat.name}
                                    onSelect={() => {
                                        onValueChange(cat.name);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === cat.name ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    );
                })}

                {/* Custom Main Categories and their children */}
                {categories.filter(c => !c.parent_id).map(mainCat => {
                    const children = categories.filter(c => c.parent_id?.toLowerCase() === mainCat.name.toLowerCase());

                    return (
                        <CommandGroup key={mainCat.id} heading={mainCat.name.charAt(0).toUpperCase() + mainCat.name.slice(1)}>
                            <CommandItem
                                value={mainCat.name}
                                onSelect={() => {
                                    onValueChange(mainCat.name);
                                    setOpen(false);
                                }}
                            >
                                <Check className={cn("mr-2 h-4 w-4", value === mainCat.name ? "opacity-100" : "opacity-0")} />
                                {mainCat.name.charAt(0).toUpperCase() + mainCat.name.slice(1)}
                            </CommandItem>

                            {children.map(child => (
                                <CommandItem
                                    key={child.id}
                                    value={child.name}
                                    onSelect={() => {
                                        onValueChange(child.name);
                                        setOpen(false);
                                    }}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", value === child.name ? "opacity-100" : "opacity-0")} />
                                    {child.name.charAt(0).toUpperCase() + child.name.slice(1)}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )
                })}
            </CommandList>
        </Command>
    );

    if (!isMobile) {
        return (
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between h-10 font-normal bg-background text-foreground hover:bg-muted/50 transition-colors"
                    >
                        <span className="truncate">{getSelectedLabel()}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                {/* w-[--radix-popover-trigger-width] ensures the popover matches the button's width exactly */}
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[200]" align="start">
                    <CommandContent />
                </PopoverContent>
            </Popover>
        );
    }

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between h-10 font-normal bg-background text-foreground hover:bg-muted/50 transition-colors"
                >
                    <span className="truncate">{getSelectedLabel()}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </DrawerTrigger>
            <DrawerContent className="z-[200]">
                <div className="mt-4 border-t">
                    <CommandContent />
                </div>
            </DrawerContent>
        </Drawer>
    );
}
