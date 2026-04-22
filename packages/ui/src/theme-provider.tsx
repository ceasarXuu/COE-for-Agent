"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>

function ThemeProvider({
  attribute = "class",
  defaultTheme = "dark",
  enableSystem = false,
  disableTransitionOnChange = true,
  ...props
}: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute={attribute}
      defaultTheme={defaultTheme}
      disableTransitionOnChange={disableTransitionOnChange}
      enableSystem={enableSystem}
      {...props}
    />
  )
}

export { ThemeProvider, useTheme }
