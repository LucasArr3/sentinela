# ☁️ Nuvem do Sentinela Tático (Firebase) — o que ligar uma vez

O app já está pronto (Ajustes → **Nuvem e backup**). Falta só **configurar o Firebase** do projeto, que exige a sua conta Google (a IA do app não tem acesso a ela).
Faça pelo prompt abaixo (num assistente com navegador, como o **Claude no Chrome**) ou manualmente (3 passos).

## Prompt para colar no assistente com navegador

```
Você vai configurar o Firebase do app "Sentinela Tático". Use o navegador, já logado na minha conta Google. Não apague nada e não mude nada além do que está listado. No final, me diga em lista o que você alterou e o que já estava certo.

Projeto Firebase / Google Cloud: gen-lang-client-0373115522
Banco Firestore (NÃO é o "(default)"): ai-studio-5b655d85-8635-4b7a-955d-c700dc9af2e1

PASSO 1 — Login por e-mail e senha
Abra https://console.firebase.google.com/project/gen-lang-client-0373115522/authentication/providers
(se aparecer "Começar", clique). Em "E-mail/senha", ative SOMENTE o primeiro interruptor "E-mail/senha" (deixe "Link de e-mail (login sem senha)" desligado) e clique em Salvar.

PASSO 2 — Regras do Firestore (cada pessoa só acessa os próprios dados)
Abra o Firestore do banco ai-studio-5b655d85-8635-4b7a-955d-c700dc9af2e1 em
https://console.firebase.google.com/project/gen-lang-client-0373115522/firestore/databases/ai-studio-5b655d85-8635-4b7a-955d-c700dc9af2e1/rules
Substitua TODO o conteúdo das regras por exatamente isto e clique em Publicar:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}

PASSO 3 — Chave da API e APIs ativadas
Abra https://console.cloud.google.com/apis/credentials?project=gen-lang-client-0373115522 , entre na chave de API "Browser key" (ou a que começa com AIzaSyC1ZF).
- Em "Restrições de aplicativo": se estiver em "Referenciadores HTTP (sites)", adicione https://localhost/* e https://lucasarr3.github.io/* (mantendo os que já existem); se estiver em "Nenhuma", deixe como está.
- Em "Restrições de API": se estiver restrita, confirme que incluem "Identity Toolkit API", "Token Service API" e "Cloud Firestore API"; adicione as que faltarem.
Salve. Depois abra https://console.cloud.google.com/apis/library?project=gen-lang-client-0373115522 e confirme que "Identity Toolkit API" e "Cloud Firestore API" estão ATIVADAS (ative se não estiverem).

TESTE: me avise quando terminar. Eu abrirei o app em Ajustes → Nuvem e backup e tocarei em "Verificar configuração": deve aparecer "Login por e-mail ativado ✅".
```

## Se preferir fazer à mão
1. Firebase → **Authentication** → *Sign-in method* → ativar **E-mail/senha**.
2. Firebase → **Firestore** → banco `ai-studio-5b655d85-…` → **Regras** → colar o conteúdo de [`firebase/firestore.rules`](../firebase/firestore.rules) → **Publicar**.
3. Google Cloud → **APIs e serviços → Credenciais** → chave do navegador: liberar `https://localhost/*` (e, se usar, `https://lucasarr3.github.io/*`) e permitir *Identity Toolkit*, *Token Service* e *Cloud Firestore*.

Com o Firebase CLI (se um dia preferir): `cd firebase && firebase deploy --only firestore`.

## Como o backup funciona
- Login só por **e-mail e senha** (separado do login do app, que continua funcionando offline).
- Os dados vão em partes de até 600 mil caracteres para `users/{seu uid}/backup/*`. Fotos e ocorrências vão junto.
- **Nunca** vão para a nuvem: a chave de IA e o PIN.
- Backup automático ~25 s depois de você mexer nos dados (pode desligar). Restaurar sempre pergunta antes de trocar os dados do aparelho.
- Se aparecer erro, o app diz o que falta (login desativado, regras, chave bloqueada).
