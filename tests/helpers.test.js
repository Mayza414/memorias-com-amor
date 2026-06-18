import { expect, test } from 'vitest';

// Simulação das funções do seu app.js para o ambiente de testes
function getInitials(name) {
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function hashSimple(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    return 'h_' + Math.abs(h).toString(36);
}

// OS TESTES REAIS:
test('Deve gerar as iniciais corretamente com letras maiúsculas', () => {
    expect(getInitials('Mayza Amorim')).toBe('MA');
    expect(getInitials('joão silva')).toBe('JS');
});

test('Deve gerar o hash da senha de forma consistente', () => {
    const hash1 = hashSimple('senha123');
    const hash2 = hashSimple('senha123');
    expect(hash1).toBe(hash2);
});