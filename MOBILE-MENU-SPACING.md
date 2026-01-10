# Menu Mobile - Ajuste de Espaçamento

## Onde mexer para ajustar o espaçamento do menu mobile:

### 1. **CSS Principal** (`src/index.css`)
Arquivo: `src/index.css` (linha ~191)

```css
.mobile-content {
  padding-bottom: calc(10px + 70px + env(safe-area-inset-bottom, 20px));
}
```

**Para ajustar o espaçamento:**
- **10px** = gap mínimo entre conteúdo e menu
- **70px** = altura do menu mobile
- **env(safe-area-inset-bottom, 20px)** = área segura do iPhone/Android

**Exemplo:** Para aumentar o gap para 20px:
```css
padding-bottom: calc(20px + 70px + env(safe-area-inset-bottom, 20px));
```

### 2. **Menu Mobile Component** (`src/components/ui/mobile-bottom-nav.tsx`)
Arquivo: `src/components/ui/mobile-bottom-nav.tsx` (linha ~29)

**Para ajustar a altura do menu:**
- Altere `min-h-[70px]` na linha ~32
- Se aumentar a altura, ajuste também o `70px` no CSS acima

**Para ajustar o z-index:**
- Altere `z-[100]` na linha ~29 (atualmente está em 100 para ficar acima de tudo)

### 3. **Spacer Global** (`src/components/Dashboard.tsx`)
Arquivo: `src/components/Dashboard.tsx` (linha ~607)

```tsx
{/* Spacer final para garantir 10px de espaço antes do menu mobile */}
<div className="h-10 lg:hidden" aria-hidden="true" />
```

**Para ajustar o spacer:**
- Altere `h-10` (40px) para outro valor se necessário
- Este spacer garante espaço mínimo mesmo em páginas curtas

### 4. **Estrutura:**
- **ÚNICO menu mobile** em: `src/components/ui/mobile-bottom-nav.tsx`
- Renderizado em: `src/components/Dashboard.tsx` (linha ~625)
- **NÃO** há menu duplicado (removido o menu inline antigo)

## Checklist para ajustar espaçamento:

1. ✅ Ajustar gap no `.mobile-content` (CSS) - padrão: 10px
2. ✅ Ajustar altura do menu se necessário (mobile-bottom-nav.tsx) - padrão: 70px
3. ✅ Ajustar spacer global se necessário (Dashboard.tsx) - padrão: h-10 (40px)
4. ✅ Verificar safe area do iPhone (env(safe-area-inset-bottom))

## Notas:

- O menu é **fixo** na parte inferior (`fixed bottom-0`)
- Usa **z-index 100** para ficar acima de tudo
- Respeita **safe areas** do iPhone/Android
- Apenas **UM menu mobile** (removido duplicado)
