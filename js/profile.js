import { logout, isAuthenticated, getToken } from './auth.js';
import { getUserInfo, getUserXP, getUserAudits } from './graphql.js';

// Check authentication
if (!isAuthenticated()) {
    window.location.href = 'index.html';
}

// DOM Elements
const userInfoElement = document.getElementById('userInfo');
const logoutBtn = document.getElementById('logoutBtn');
const xpGraph = document.getElementById('xpGraph');
const auditGraph = document.getElementById('auditGraph');

// Event Listeners
logoutBtn.addEventListener('click', logout);

// Load user data
const loadUserData = async () => {
    try {
        const userInfo = await getUserInfo();
        const xpData = await getUserXP();
        const auditData = await getUserAudits();
        
        console.log('User Info:', userInfo);
        console.log('XP Data:', xpData);
        console.log('Audit Data:', auditData);
        
        displayUserInfo(userInfo.user);
        if (xpData.xp && xpData.xp.length > 0) {
            createXPGraph(xpData.xp);
        }
        createAuditGraph({
            transaction: auditData.up,
            transaction1: auditData.down
        });
        
    } catch (error) {
        console.error('GraphQL Error:', error);
    }
};


// Display user information
const displayUserInfo = (user) => {
    userInfoElement.innerHTML = `
        <h2>${user[0].login}</h2>
        <p>Email: ${user[0].email}</p>
        <p>Created: ${new Date(user.createdAt).toLocaleDateString()}</p>
    `;
};

// Create XP Progress Graph
const createXPGraph = (transactions) => {
    let totalXP = 0;
    const dataPoints = transactions.map(t => {
        totalXP += t.amount;
        return {
            date: new Date(t.createdAt),
            xp: totalXP
        };
    });

    const minDate = dataPoints[0]?.date || new Date();
    const maxDate = dataPoints[dataPoints.length - 1]?.date || new Date();
    const maxXP = totalXP;

    const points = dataPoints.map((p, i) => {
        const x = ((p.date - minDate) / (maxDate - minDate)) * 380 + 10;
        const y = 290 - (p.xp / maxXP * 280);
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');

    xpGraph.innerHTML = `
        <path d="${points}" fill="none" stroke="#007bff" stroke-width="2"/>
        <text x="200" y="20" text-anchor="middle">Total XP: ${Math.round(totalXP)}</text>
    `;
};

// Create Audit Ratio Graph
const createAuditGraph = ({ transaction: upTransactions, transaction1: downTransactions }) => {
    const totalUp = upTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalDown = downTransactions.reduce((sum, t) => sum + t.amount, 0);
    const total = totalUp + totalDown;
    
    const radius = 100;
    const centerX = 200;
    const centerY = 150;
    
    const upRatio = totalUp / total;
    const upAngle = upRatio * Math.PI * 2;
    
    const createArc = (startAngle, endAngle) => {
        const x1 = centerX + radius * Math.cos(startAngle);
        const y1 = centerY + radius * Math.sin(startAngle);
        const x2 = centerX + radius * Math.cos(endAngle);
        const y2 = centerY + radius * Math.sin(endAngle);
        const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
        
        return `M ${centerX},${centerY} L ${x1},${y1} A ${radius},${radius} 0 ${largeArc} 1 ${x2},${y2} Z`;
    };

    auditGraph.innerHTML = `
        <path d="${createArc(0, upAngle)}" fill="#28a745"/>
        <path d="${createArc(upAngle, Math.PI * 2)}" fill="#dc3545"/>
        <text x="200" y="140" text-anchor="middle">Audit Ratio</text>
        <text x="200" y="160" text-anchor="middle">${Math.round(upRatio * 100)}% Positive</text>
    `;
};
// Initialize
loadUserData();
