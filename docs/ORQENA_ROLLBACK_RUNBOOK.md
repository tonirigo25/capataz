# Runbook de rollback

1. Congelar deployments y registrar IDs exactos.
2. Confirmar el último `SUCCESS` anterior y su SHA/rama.
3. Restaurar la fuente verificada.
4. Usar rollback oficial o redeploy exacto del artefacto histórico; nunca `railway up` desde otro worktree.
5. No ejecutar migraciones manuales ni alterar estados Prisma sin evidencia.
6. Validar health, HTTPS, logs y ausencia de pendientes sin consultar datos empresariales.
7. Si existe incompatibilidad de esquema, detenerse y restaurar el snapshot/PITR autorizado.

Staging no compartirá proyecto ni servicio lógico con production.
