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
              id
              login
              firstName
              lastName
              email
              campus
              attrs
              transactions(order_by: {amount: desc}, where: {type: {_eq: "level"}}, limit: 1) {
                  type
                  amount
              }
          }
      }
      `;
      return fetchGraphQL(query);
  };
// Query: Get user XP transactions
const getUserXP = async () => {
    const query = `
      {
        transaction(
            where: {type: {_eq: "xp"}, event: {object: {name: {_eq: "Module"}}}}
            order_by: {id: asc}
        ) {
            object{name}
            id
            amount
            createdAt
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

// Query: Get user finsihed projects info
const getUserFinishedProjects = async () => {
    const query = `
        query {
            user {
                projectEx: transactions(
                    order_by: { createdAt: desc }
                    where: {
                        _and: [
                            { type: { _eq: "xp" } }
                            { progress: { isDone: { _eq: true } } }
                            { path: { _ilike: "%/bahrain/bh-module/%" } }
                            { object: { type: { _eq: "project" } } }
                        ]
                    }
                ) {
                    userLogin
                    type
                    amount
                    path
                    createdAt
                    object {
                        name
                        type
                    }
                }
            }
        }
    `;
    return fetchGraphQL(query);
};

const getSkillDetails = async (userId) => {
    const query = `
        query user($userId: Int!) {
    user: user_by_pk(id: $userId) {
      transactions (
        order_by: [{ type: desc }, { amount: desc }]
        distinct_on: [type]
        where: { userId: { _eq: $userId }, type: { _like: "skill_%" } },
      )
      { type, amount }
    }
  }
    `;
    return fetchGraphQL(query, { userId });
};




export {
    getUserInfo,
    getUserXP,
    getUserAudits,
    getUserFinishedProjects,
    getSkillDetails
};
