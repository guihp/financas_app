# Exemplos cURL - API de Agendamentos

## Base URL
```
https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/
```

## Headers Padrão
```bash
-H "Content-Type: application/json"
-H "Authorization: Bearer SEU_TOKEN_JWT_AQUI"
```

---

## 1. Criar Agendamento

### Exemplo Básico (apenas campos obrigatórios)
```bash
curl -X POST "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/add-appointment" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+5511999999999",
    "title": "Consulta médica",
    "date": "2025-08-15"
  }'
```

### Exemplo Completo (todos os campos)
```bash
curl -X POST "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/add-appointment" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+5511999999999",
    "title": "Reunião de trabalho",
    "description": "Discussão do projeto Q1 e definição de metas",
    "date": "2025-08-15",
    "time": "14:30"
  }'
```

### Exemplo com Dados Reais
```bash
curl -X POST "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/add-appointment" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+5511987654321",
    "title": "Consulta Cardiologista",
    "description": "Exames de rotina e acompanhamento",
    "date": "2025-08-20",
    "time": "09:30"
  }'
```

---

## 2. Excluir Agendamento

### Exemplo Básico
```bash
curl -X DELETE "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/delete-appointment" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+5511999999999",
    "appointment_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

### Exemplo com Dados Reais
```bash
curl -X DELETE "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/delete-appointment" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+5511987654321",
    "appointment_id": "a28f4e5d-0f5d-437d-838f-3e76da53e0e7"
  }'
```

---

## 3. Exemplos por Categoria

### Consultas Médicas
```bash
# Dentista
curl -X POST "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/add-appointment" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+5511987654321",
    "title": "Consulta Odontológica",
    "description": "Limpeza e avaliação geral",
    "date": "2025-08-12",
    "time": "10:00"
  }'

# Oftalmologista
curl -X POST "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/add-appointment" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+5511987654321",
    "title": "Exame de Vista",
    "description": "Renovação de receita para óculos",
    "date": "2025-08-18",
    "time": "15:30"
  }'
```

### Reuniões de Trabalho
```bash
# Reunião de Equipe
curl -X POST "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/add-appointment" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+5511987654321",
    "title": "Reunião Semanal",
    "description": "Alinhamento de projetos e metas da semana",
    "date": "2025-08-11",
    "time": "09:00"
  }'

# Apresentação para Cliente
curl -X POST "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/add-appointment" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+5511987654321",
    "title": "Apresentação Proposta",
    "description": "Apresentação da solução para Cliente ABC",
    "date": "2025-08-22",
    "time": "14:00"
  }'
```

### Compromissos Pessoais
```bash
# Academia
curl -X POST "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/add-appointment" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+5511987654321",
    "title": "Personal Trainer",
    "description": "Treino de força - foco em membros superiores",
    "date": "2025-08-14",
    "time": "18:00"
  }'

# Compromisso Familiar
curl -X POST "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/add-appointment" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+5511987654321",
    "title": "Jantar em Família",
    "description": "Aniversário da vovó - restaurante italiano",
    "date": "2025-08-16",
    "time": "19:30"
  }'
```

---

## 4. Comandos para Desenvolvimento/Teste

### Criar múltiplos agendamentos para teste
```bash
# Agendamento 1
curl -X POST "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/add-appointment" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+5511999999999","title":"Teste 1","date":"2025-08-10","time":"09:00"}'

# Agendamento 2
curl -X POST "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/add-appointment" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+5511999999999","title":"Teste 2","date":"2025-08-10","time":"14:00"}'

# Agendamento 3
curl -X POST "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/add-appointment" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+5511999999999","title":"Teste 3","date":"2025-08-11"}'
```

### Teste de Validação (deve retornar erro)
```bash
# Sem título (erro 400)
curl -X POST "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/add-appointment" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+5511999999999",
    "date": "2025-08-15"
  }'

# Sem data (erro 400)
curl -X POST "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/add-appointment" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+5511999999999",
    "title": "Teste sem data"
  }'

# Telefone inexistente (erro 404)
curl -X POST "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/add-appointment" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+5511000000000",
    "title": "Teste",
    "date": "2025-08-15"
  }'
```

---

## 5. Comandos Úteis para Debug

### Ver resposta completa com headers
```bash
curl -X POST "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/add-appointment" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+5511999999999","title":"Debug Test","date":"2025-08-15"}' \
  -v
```

### Salvar resposta em arquivo
```bash
curl -X POST "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/add-appointment" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+5511999999999","title":"Save Test","date":"2025-08-15"}' \
  -o response.json
```

### Apenas mostrar status code
```bash
curl -X POST "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/add-appointment" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+5511999999999","title":"Status Test","date":"2025-08-15"}' \
  -w "%{http_code}" \
  -s -o /dev/null
```

---

## 6. Template para Automação

### Script Bash para criar agendamento
```bash
#!/bin/bash

PHONE="$1"
TITLE="$2"
DATE="$3"
TIME="$4"
DESCRIPTION="$5"

if [ -z "$PHONE" ] || [ -z "$TITLE" ] || [ -z "$DATE" ]; then
    echo "Uso: $0 <telefone> <titulo> <data> [horario] [descricao]"
    echo "Exemplo: $0 '+5511999999999' 'Consulta' '2025-08-15' '14:30' 'Consulta médica'"
    exit 1
fi

JSON_DATA="{\"phone\":\"$PHONE\",\"title\":\"$TITLE\",\"date\":\"$DATE\""

if [ ! -z "$TIME" ]; then
    JSON_DATA="$JSON_DATA,\"time\":\"$TIME\""
fi

if [ ! -z "$DESCRIPTION" ]; then
    JSON_DATA="$JSON_DATA,\"description\":\"$DESCRIPTION\""
fi

JSON_DATA="$JSON_DATA}"

curl -X POST "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/add-appointment" \
  -H "Content-Type: application/json" \
  -d "$JSON_DATA"
```

### Como usar o script:
```bash
chmod +x criar_agendamento.sh
./criar_agendamento.sh "+5511999999999" "Consulta" "2025-08-15" "14:30" "Consulta médica"
```

---

## Notas Importantes

1. **Formato do telefone**: Use sempre o formato internacional `+5511999999999`
2. **Formate datas** sempre como `YYYY-MM-DD`
3. **Formate horários** sempre como `HH:MM` (24h)
4. **Escape aspas** em comandos bash se necessário: `\"titulo com aspas\"`
5. **Use -v** para ver headers completos em caso de debug
6. **Telefone deve estar cadastrado** no sistema na tabela `profiles`