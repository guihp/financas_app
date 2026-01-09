# API de Exclusão de Usuário

## Descrição
Esta API permite excluir usuários do sistema através do email.

## Endpoint
**POST** `https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/delete-user`

## Headers
```
Content-Type: application/json
```

## Body (JSON)
```json
{
  "email": "usuario@exemplo.com"
}
```

### Parâmetros Obrigatórios
- **email** (string): Email do usuário a ser excluído

## Respostas

### Sucesso (200)
```json
{
  "success": true,
  "message": "User deleted successfully",
  "user": {
    "id": "uuid-do-usuario",
    "email": "usuario@exemplo.com"
  }
}
```

### Erro - Parâmetros Inválidos (400)
```json
{
  "error": "Email is required"
}
```

### Erro - Usuário Não Encontrado (404)
```json
{
  "error": "User not found"
}
```

### Erro - Falha no Servidor (500)
```json
{
  "error": "Failed to delete user"
}
```

## Códigos de Status
- **200**: Usuário excluído com sucesso
- **400**: Parâmetros inválidos ou ausentes
- **404**: Usuário não encontrado
- **500**: Erro interno do servidor

## Observações
- Esta operação é **irreversível**
- Todos os dados associados ao usuário serão excluídos permanentemente
- A função requer privilégios de administrador (service role)