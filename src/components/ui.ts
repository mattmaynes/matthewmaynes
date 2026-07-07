"use client";

/**
 * Client boundary for Canopy.
 *
 * Canopy's published dist does NOT carry "use client" directives, and its
 * barrels evaluate React context at module scope (e.g. FormField). Imported
 * directly into a Server Component that fails during build with
 * "createContext is not a function". Re-exporting through this "use client"
 * module puts Canopy on the client side of the boundary, so Server Components
 * can render these components safely. Import Canopy from here, not from
 * "@rogueoak/canopy/*" directly.
 */

export { Badge, Button, Input, Textarea } from "@rogueoak/canopy/seeds";
export {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  FormField,
  FormFieldControl,
  FormFieldDescription,
  FormFieldLabel,
  FormFieldMessage,
} from "@rogueoak/canopy/twigs";
export {
  TopNav,
  TopNavActions,
  TopNavBrand,
  TopNavLink,
  TopNavLinks,
  TopNavMenuButton,
} from "@rogueoak/canopy/branches";
