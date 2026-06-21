# Checklist de publicación

## Apple

- Crear cuenta Apple Developer.
- Configurar App Store Connect.
- Crear nueva app.
- Bundle ID: `com.capataz.app`.
- Nombre visible: `Capataz`.
- Configurar categoría Productividad o Empresa.
- Abrir Xcode con `npx cap open ios`.
- Seleccionar Team Apple Developer.
- Revisar Signing & Capabilities.
- Archive.
- Distribute App.
- Upload to App Store Connect.
- Añadir capturas.
- Añadir descripción.
- Añadir política de privacidad: `https://capataz.app/privacidad`.
- Añadir URL soporte: `https://capataz.app/soporte`.
- Añadir datos de revisión.
- Indicar cuenta demo o acceso sin login.
- Activar TestFlight si procede.
- Enviar a revisión.

## Google

- Crear cuenta Play Console.
- Crear app.
- Package name: `com.capataz.app`.
- Configurar ficha Play Store.
- Subir AAB desde `android/app/build/outputs/bundle/release/app-release.aab`.
- Configurar Play App Signing.
- Añadir política de privacidad: `https://capataz.app/privacidad`.
- Añadir URL soporte: `https://capataz.app/soporte`.
- Añadir capturas.
- Completar Data Safety.
- Completar clasificación de contenido.
- Configurar Internal Testing.
- Configurar Closed Testing si procede.
- Añadir testers.
- Publicar internal/closed testing.
- Solicitar producción cuando corresponda.

## Antes de subir cualquier build

- `npm run typecheck`.
- `npm run build`.
- `npx cap sync android`.
- `npx cap sync ios` en Mac.
- Probar modo demo.
- Probar modo staging/production con backend público.
- Confirmar que la app no apunta a `localhost` ni `10.0.2.2`.
- Confirmar que no hay keystore, passwords ni secretos en el repositorio.
