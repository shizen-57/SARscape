import type { ButtonHTMLAttributes, ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cva } from 'class-variance-authority'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { X } from 'lucide-react'

export const cn = (...args: Parameters<typeof clsx>) => twMerge(clsx(...args))
const button = cva('button', { variants: { variant: { default: 'button-primary', outline: 'button-outline', ghost: 'button-ghost' }, size: { default: '', icon: 'button-icon', small: 'button-small' } }, defaultVariants: { variant: 'default', size: 'default' } })
export function Button({ variant = 'default', size = 'default', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost'; size?: 'default' | 'icon' | 'small' }) { return <button className={cn(button({ variant, size }), className)} {...props} /> }
export function Switch({ checked, onCheckedChange, label }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: string }) { return <SwitchPrimitive.Root className="switch" checked={checked} onCheckedChange={onCheckedChange} aria-label={label}><SwitchPrimitive.Thumb className="switch-thumb" /></SwitchPrimitive.Root> }
export function Tooltip({ children, label }: { children: ReactNode; label: string }) { return <TooltipPrimitive.Root><TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger><TooltipPrimitive.Portal><TooltipPrimitive.Content className="tooltip" sideOffset={7}>{label}<TooltipPrimitive.Arrow /></TooltipPrimitive.Content></TooltipPrimitive.Portal></TooltipPrimitive.Root> }
export const TooltipProvider = TooltipPrimitive.Provider
export function Sheet({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (v: boolean) => void; title: string; description: string; children: ReactNode }) { return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="sheet-overlay" /><Dialog.Content className="sheet"><div className="sheet-heading"><div><Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description}</Dialog.Description></div><Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Close panel"><X size={20} /></Button></Dialog.Close></div>{children}</Dialog.Content></Dialog.Portal></Dialog.Root> }
