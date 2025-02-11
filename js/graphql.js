import { getToken } from './auth.js';

const GRAPHQL_ENDPOINT = 'https://learn.reboot01.com/api/graphql-engine/v1/graphql';

// Maximum number of retries for failed requests
const MAX_RETRIES = 2;

// GraphQL client setup with retry capability
const fetchGraphQL = async (query, variables = {}, retryCount = 0) => {
    try {
        // Validate token before making request
        const token = getToken();
        if (!token) {
            throw new Error('Authentication required');
        }

        const response = await fetch(GRAPHQL_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                query,
                variables
            })
        });

        if (!response.ok) {
            // Handle specific HTTP errors
            if (response.status === 401) {
                throw new Error('Authentication expired');
            }
            throw new Error(`GraphQL request failed: ${response.status}`);
        }

        const data = await response.json();
        
        // Handle GraphQL errors
        if (data.errors) {
            const errorMessage = data.errors.map(e => e.message).join(', ');
            throw new Error(`GraphQL errors: ${errorMessage}`);
        }

        return data.data;
    } catch (error) {
        // Retry on network errors or 500s, but not on auth errors
        if (retryCount < MAX_RETRIES && 
            (!error.message.includes('Authentication') || 
             error.message.includes('500'))) {
            console.log(`Retrying GraphQL request (${retryCount + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return fetchGraphQL(query, variables, retryCount + 1);
        }
        throw error;
    }
};

// Query: Get user basic information
const getUserInfo = async () => {
    const query = `
    query {
        user {
            email
            login
            createdAt
            attrs
        }
    }
    `;
    return fetchGraphQL(query);
};

// Query: Get user XP transactions
const getUserXP = async () => {
    const query = `
        query {
            xp: transaction(where: {type: {_eq: "xp"}}, order_by: {createdAt: asc}) {
                amount
                createdAt
                path
            }
        }
    `;
    return fetchGraphQL(query);
};

// Query: Get user audit ratio
const getUserAudits = async () => {
    const query = `
        query {
            up: transaction(where: {type: {_eq: "up"}}) {
                amount
                path
                createdAt
            }
            down: transaction(where: {type: {_eq: "down"}}) {
                amount
                path
                createdAt
            }
        }
    `;
    return fetchGraphQL(query);
};

// Query: Get user XP and audit transactions in one query
const getUserStats = async () => {
    const query = `
        query {
            xpTransactions: transaction(where: {type: {_eq: "xp"}}, order_by: {createdAt: asc}) {
                amount
                createdAt
                path
            }
            upTransactions: transaction(where: {type: {_eq: "up"}}) {
                amount
                path
                createdAt
            }
            downTransactions: transaction(where: {type: {_eq: "down"}}) {
                amount
                path
                createdAt
            }
        }
    `;
    return fetchGraphQL(query);
};

export {
    getUserInfo,
    getUserXP,
    getUserAudits,
    getUserStats
};
