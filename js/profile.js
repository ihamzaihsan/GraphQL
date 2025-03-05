import { logout, isAuthenticated, getToken } from './auth.js';
import { getUserInfo, getUserXP, getUserAudits, getUserFinshedProjects, getSkillDetails} from './graphql.js';

// Check authentication
if (!isAuthenticated()) {
    window.location.href = 'index.html';
}

// DOM Elements
const userInfoElement = document.getElementById('userInfo');
const logoutBtn = document.getElementById('logoutBtn');
const auditGraph = document.getElementById('auditGraph');

// Event Listeners
logoutBtn.addEventListener('click', () => {
    // Add a small animation before logout
    logoutBtn.classList.add('logging-out');
    setTimeout(() => {
        logout();
    }, 300);
});

const getCssVar = (varName) => 
    getComputedStyle(document.documentElement)
        .getPropertyValue(varName)
        .trim();

// Load user data with loading states
const loadUserData = async () => {
    try {
        // Show loading states
        userInfoElement.innerHTML = `
            <div class="loading-skeleton">
                <div class="skeleton-line"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line"></div>
            </div>
        `;

        const userInfoData = await getUserInfo();
        const userId = userInfoData.user[0].id;
        
        // Fetch all data in parallel for better performance
        const [userInfo, xpData, auditData, finishedProjects, skillData] = await Promise.all([
            getUserInfo(),
            getUserXP(),
            getUserAudits(),
            getUserFinshedProjects(),
            getSkillDetails(userId)
        ]);

        console.log('skillData', skillData);


        if (skillData?.user?.transactions) {
            createTechnicalSkillsRadar(skillData.user.transactions);
            createTechnologySkillsRadar(skillData.user.transactions);
        }
        
        // Display data once loaded
        displayUserInfo(userInfo.user);
        
        if (xpData.transaction && xpData.transaction.length > 0) {
            createXPGraph(xpData.transaction);
        }
        
        createAuditGraph({
            transaction: auditData.up,
            transaction1: auditData.down
        });

        displayCompletedProjects(finishedProjects);
        
    } catch (error) {
        console.error('GraphQL Error:', error);
        // Show error states
        userInfoElement.innerHTML = `
            <div class="error-message">
                <p>Failed to load user data. Please try again later.</p>
            </div>
        `;
    }
};

// Display user information with enhanced layout
const displayUserInfo = (user) => {
    // Extract user data from the first element in the array
    const userData = user[0];
    
    // Get name components or use fallbacks
    const firstName = userData.firstName || userData.attrs?.firstName || "";
    const lastName = userData.lastName || userData.attrs?.lastName || "";
    const fullName = `${firstName} ${lastName}`.trim() || "Not specified";
    
    // Get location information
    const city = userData.addressCity || userData.attrs?.addressCity || "";
    const country = userData.addressCountry || userData.attrs?.addressCountry || "";
    const location = [city, country].filter(Boolean).join(", ") || "Not specified";
    
    // Get level information
    const level = userData.transactions && userData.transactions.length > 0 ? 
             userData.transactions[0].amount : "N/A";

    const campusName = userData.campus || "Not specified";
    
    userInfoElement.innerHTML = `
        <h2>User Information</h2>
        <p><strong>Full Name</strong> ${fullName}</p>
        <p><strong>Username</strong> ${userData.login}</p>
        <p><strong>Email</strong> ${userData.email}</p>
        <p><strong>Campus Location</strong> ${campusName}</p>
        <p><strong>Lives in</strong> ${location}</p>
        <p><strong>Level</strong> ${level}</p>
    `;

    // Add animation to the user info section
    const userInfoItems = userInfoElement.querySelectorAll('p');
    userInfoItems.forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(10px)';
        setTimeout(() => {
            item.style.transition = 'all 0.3s ease';
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
        }, 100 * index);
    });
};

// Enhanced XP Graph with better animations and interactivity
const createXPGraph = (transactions) => {
    const svg = d3.select('.xp-progression-svg');
    const tooltip = d3.select('.xp-tooltip');
    
    // Clear previous elements
    svg.selectAll('.hover-line').remove();
    svg.selectAll('.x-axis').remove();
    svg.selectAll('.y-axis').remove();

    // Data processing
    let cumulativeXP = 0;
    const data = transactions.map(t => {
        cumulativeXP += t.amount;
        return {
            date: new Date(t.createdAt),
            xp: cumulativeXP,
            delta: t.amount
        };
    });

    // Dimensions
    const width = 800;
    const height = 400;
    const margin = { top: 20, right: 40, bottom: 60, left: 70 };

    // Function to convert XP to KB
    const xpToKB = (xp) => {
        return (xp / 1000).toFixed(2);
    };

    // Scales
    const xScale = d3.scaleTime()
        .domain(d3.extent(data, d => d.date))
        .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.xp) * 1.1]) // Add 10% padding at the top
        .nice()
        .range([height - margin.bottom, margin.top]);

    // Line generator with smooth curve
    const line = d3.line()
        .x(d => xScale(d.date))
        .y(d => yScale(d.xp))
        .curve(d3.curveCatmullRom.alpha(0.5)); // Smoother curve

    // Area generator
    const area = d3.area()
        .x(d => xScale(d.date))
        .y0(yScale(0))
        .y1(d => yScale(d.xp))
        .curve(d3.curveCatmullRom.alpha(0.5)); // Match the line curve

    // Animated path drawing with improved animation
    svg.select('.xp-path')
        .datum(data)
        .attr('d', area)
        .style('opacity', 0)
        .transition()
        .duration(1000)
        .style('opacity', 1)
        .attrTween('d', function() {
            const interpolate = d3.interpolateArray(
                data.map(d => ({ ...d, xp: 0 })), 
                data
            );
            return t => area(interpolate(t));
        });

    svg.select('.xp-line')
        .datum(data)
        .attr('d', line)
        .style('opacity', 0)
        .style('stroke-dasharray', function() {
            return this.getTotalLength();
        })
        .style('stroke-dashoffset', function() {
            return this.getTotalLength();
        })
        .style('opacity', 1)
        .transition()
        .duration(1500)
        .ease(d3.easeCubicOut)
        .style('stroke-dashoffset', 0);

    // Add grid lines for better readability
    const xGrid = d3.axisBottom(xScale)
        .tickSize(-(height - margin.top - margin.bottom))
        .tickFormat('')
        .ticks(10);
        
    const yGrid = d3.axisLeft(yScale)
        .tickSize(-(width - margin.left - margin.right))
        .tickFormat('')
        .ticks(5);
        
    svg.select('.grid-x')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(xGrid)
        .style('opacity', 0)
        .transition()
        .duration(500)
        .delay(1000)
        .style('opacity', 0.5);
        
    svg.select('.grid-y')
        .attr('transform', `translate(${margin.left},0)`)
        .call(yGrid)
        .style('opacity', 0)
        .transition()
        .duration(500)
        .delay(1000)
        .style('opacity', 0.5);

    // Interactive points with staggered animation
    svg.select('.data-points').selectAll('*').remove();
    
    const points = svg.select('.data-points')
        .selectAll('.data-point')
        .data(data)
        .enter().append('circle')
        .attr('class', 'data-point')
        .attr('cx', d => xScale(d.date))
        .attr('cy', d => yScale(d.xp))
        .attr('r', 0)
        .attr('fill', getCssVar('--accent-primary'))
        .style('opacity', 0.8)
        .style('filter', 'drop-shadow(0 2px 3px rgba(99, 102, 241, 0.3))');
        
    points.transition()
        .delay((d, i) => 1000 + i * 50)
        .duration(300)
        .attr('r', 4)
        .style('opacity', 1);

    // Enhanced interactivity with hover line
    const hoverLine = svg.append('line')
        .attr('class', 'hover-line')
        .attr('y1', margin.top)
        .attr('y2', height - margin.bottom)
        .style('opacity', 0);

    // Add interactivity with improved tooltip
    svg.on('mousemove', (event) => {
        const [xCoord] = d3.pointer(event);
        const bisectDate = d3.bisector(d => d.date).left;
        const x0 = xScale.invert(xCoord);
        const i = bisectDate(data, x0, 1);
        const d0 = data[i - 1];
        const d1 = data[i];
        
        if (!d0 || !d1) return;
        
        const d = x0 - d0.date > d1.date - x0 ? d1 : d0;
        
        // Update hover line
        hoverLine
            .attr('x1', xScale(d.date))
            .attr('x2', xScale(d.date))
            .style('opacity', 0.5);
        
        // Highlight the current point
        svg.selectAll('.data-point')
            .attr('r', 4)
            .style('filter', 'drop-shadow(0 2px 3px rgba(99, 102, 241, 0.3))');
            
        svg.selectAll('.data-point')
            .filter(point => point.date.getTime() === d.date.getTime())
            .attr('r', 6)
            .style('filter', 'drop-shadow(0 0 6px rgba(99, 102, 241, 0.6))');
        
        // Convert SVG coordinates to screen coordinates
        const svgNode = svg.node();
        const point = svgNode.createSVGPoint();
        point.x = xScale(d.date);
        point.y = yScale(d.xp);
        const screenCoords = point.matrixTransform(svgNode.getScreenCTM());
        
        // Get container offset
        const container = d3.select('.xp-graph-container').node();
        const containerRect = container.getBoundingClientRect();
        
        // Format date nicely
        const formatDate = d3.timeFormat('%b %d, %Y');
        
        // Position tooltip with enhanced content
        tooltip.style('opacity', 1)
            .html(`
                <div class="tooltip-content">
                    <strong>${formatDate(d.date)}</strong>
                    <div>Total XP: <span style="color: var(--accent-primary); font-weight: 600;">${xpToKB(d.xp)} KB</span></div>
                    <div>Gained: <span style="color: #10b981; font-weight: 600;">+${xpToKB(d.delta)} KB</span></div>
                </div>
            `)
            .style('left', `${screenCoords.x - containerRect.left}px`)
            .style('top', `${screenCoords.y - containerRect.top - 20}px`)
            .style('transform', 'translate(-50%, -100%)');
    }).on('mouseleave', () => {
        tooltip.style('opacity', 0);
        hoverLine.style('opacity', 0);
        
        // Reset all points
        svg.selectAll('.data-point')
            .attr('r', 4)
            .style('filter', 'drop-shadow(0 2px 3px rgba(99, 102, 241, 0.3))');
    });

    // Axes with better formatting
    const xAxis = d3.axisBottom(xScale)
        .ticks(d3.timeMonth.every(1))
        .tickSizeOuter(0)
        .tickFormat(d3.timeFormat('%b %Y'));

    const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(d => `${d3.format('.2s')(d)} XP`);

    svg.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(xAxis)
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-45)');

    svg.append('g')
        .attr('class', 'y-axis')
        .attr('transform', `translate(${margin.left},0)`)
        .call(yAxis);
        
    // Add axis labels for better clarity
    svg.append('text')
        .attr('class', 'axis-label')
        .attr('text-anchor', 'middle')
        .attr('x', width / 2)
        .attr('y', height - 10)
        .style('font-size', '12px')
        .style('fill', '#64748b')
        .text('Date');
        
    svg.append('text')
        .attr('class', 'axis-label')
        .attr('text-anchor', 'middle')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', 25)
        .style('font-size', '12px')
        .style('fill', '#64748b')
        .text('Experience Points');
};

// Enhanced Audit Ratio Graph with better animations
const createAuditGraph = ({ transaction: upTransactions, transaction1: downTransactions }) => {
    // Decimal MB conversion (1 MB = 1,000,000 bytes)
    const bytesToMB = (bytes) => (bytes / 1000000).toFixed(2);
    
    const totalUp = upTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalDown = downTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    // Calculate ratio as totalDown/totalUp with one decimal point
    const ratio = totalUp > 0 
        ? (totalUp / totalDown).toFixed(1)
        : '0.0'; // Handle division by zero

    const centerX = 200;
    const centerY = 130;
    const radius = 100;
    const innerRadius = 60;
    
    const createDonutPath = (startAngle, endAngle) => {
        const start = {
            xOuter: centerX + radius * Math.cos(startAngle),
            yOuter: centerY + radius * Math.sin(startAngle),
            xInner: centerX + innerRadius * Math.cos(startAngle),
            yInner: centerY + innerRadius * Math.sin(startAngle)
        };
        
        const end = {
            xOuter: centerX + radius * Math.cos(endAngle),
            yOuter: centerY + radius * Math.sin(endAngle),
            xInner: centerX + innerRadius * Math.cos(endAngle),
            yInner: centerY + innerRadius * Math.sin(endAngle)
        };
        
        const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
        
        return `M ${start.xOuter} ${start.yOuter}
                A ${radius} ${radius} 0 ${largeArc} 1 ${end.xOuter} ${end.yOuter}
                L ${end.xInner} ${end.yInner}
                A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${start.xInner} ${start.yInner}
                Z`;
    };

    // Calculate angles for animation
    const upRatio = totalUp / (totalUp + totalDown);
    const downRatio = totalDown / (totalUp + totalDown);
    const upAngle = upRatio * Math.PI * 2;
    const downAngle = downRatio * Math.PI * 2;

    auditGraph.innerHTML = `
        <svg viewBox="0 0 400 300" width="100%" height="100%">
            <defs>
                <filter id="shadow">
                    <feDropShadow dx="2" dy="2" stdDeviation="2" flood-opacity="0.2"/>
                </filter>
                <linearGradient id="gradient-up" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#4CAF50"/>
                    <stop offset="100%" stop-color="#2E7D32"/>
                </linearGradient>
                <linearGradient id="gradient-down" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#FF5252"/>
                    <stop offset="100%" stop-color="#D32F2F"/>
                </linearGradient>
            </defs>
            
            <!-- Background Circle -->
            <path d="${createDonutPath(0, Math.PI * 2)}" fill="#eee" filter="url(#shadow)"/>
            
            <!-- Done Transactions -->
            <path class="slice" d="${createDonutPath(0, upAngle)}" 
                  fill="url(#gradient-up)" filter="url(#shadow)"/>
            
            <!-- Received Transactions -->
            <path class="slice" d="${createDonutPath(upAngle, Math.PI * 2)}"
                  fill="url(#gradient-down)" filter="url(#shadow)"/>
            
            <!-- Center Text -->
            <g transform="translate(200, 130)">
                <circle r="50" fill="white" opacity="0.9"/>
                <text text-anchor="middle" dy="-10" font-size="32" font-weight="700" fill="#2E7D32" class="ratio-text">
                    ${ratio}
                </text>
                <text text-anchor="middle" dy="20" font-size="14" fill="#666">
                    Ratio
                </text>
            </g>
            
            <!-- Legend -->
            <g transform="translate(50, 255)">
                <rect width="16" height="16" fill="url(#gradient-up)" rx="3"/>
                <text x="24" y="13" font-size="14">Done: ${bytesToMB(totalUp)} MB</text>
            </g>
            <g transform="translate(230, 255)">
                <rect width="16" height="16" fill="url(#gradient-down)" rx="3"/>
                <text x="24" y="13" font-size="14">Received: ${bytesToMB(totalDown)} MB</text>
            </g>
        </svg>
    `;

    // Add animation to the ratio text
    const ratioText = auditGraph.querySelector('.ratio-text');
    if (ratioText) {
        const finalValue = parseFloat(ratio);
        let startValue = 0;
        const duration = 1500;
        const startTime = performance.now();
        
        const animateRatio = (currentTime) => {
            const elapsedTime = currentTime - startTime;
            const progress = Math.min(elapsedTime / duration, 1);
            
            // Easing function for smoother animation
            const easeOutQuad = t => t * (2 - t);
            const easedProgress = easeOutQuad(progress);
            
            const currentValue = (finalValue * easedProgress).toFixed(1);
            ratioText.textContent = currentValue;
            
            if (progress < 1) {
                requestAnimationFrame(animateRatio);
            }
        };
        
        requestAnimationFrame(animateRatio);
    }
};

const displayCompletedProjects = async (projectsData) => {
    try {
        // Extract the projects array based on the actual response structure
        let projects = [];
        if (projectsData?.user && Array.isArray(projectsData.user)) {
            // If the response has a user array, get the first user's projectEx
            projects = projectsData.user[0]?.projectEx || [];
        }

        const tableBody = document.querySelector('.projects-table tbody');
        
        // Clear existing rows
        tableBody.innerHTML = '';
        
        // Format date function
        const formatDate = (dateString) => {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        };
        
        // Create table rows with staggered animation
        projects.forEach((project, index) => {
            const row = document.createElement('tr');
            row.style.opacity = '0';
            row.style.transform = 'translateY(10px)';
            
            row.innerHTML = `
                <td>${project.object?.name || 'N/A'}</td>
                <td><span class="xp-badge">${(project.amount / 1000).toFixed(2)} KB</span></td>
                <td class="date-cell">${formatDate(project.createdAt)}</td>
                <td>
                    <a href="https://learn.reboot01.com/intra${project.path}" 
                       target="_blank" 
                       rel="noopener noreferrer">
                        View Project
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 4px;">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                    </a>
                </td>
            `;
            
            tableBody.appendChild(row);
            
            // Staggered animation
            setTimeout(() => {
                row.style.transition = 'all 0.3s ease';
                row.style.opacity = '1';
                row.style.transform = 'translate y(0)';
            }, 100 * index);
        });
        
        // Add empty state if no projects
        if (projects.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-state">
                        No completed projects found
                    </td>
                </tr>
            `;
        }
        
    } catch (error) {
        console.error('Error loading completed projects:', error);
        document.querySelector('.projects-table tbody').innerHTML = `
            <tr>
                <td colspan="4" class="error-state">
                    Error loading projects. Please try again later.
                </td>
            </tr>
        `;
    }
};



// Add page load animation
document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('header');
    const graphs = document.querySelectorAll('.graph, .xp-graph-card');
    const projectsContainer = document.querySelector('.completed-projects-container');
    
    // Animate header
    header.style.opacity = '0';
    header.style.transform = 'translateY(-20px)';
    setTimeout(() => {
        header.style.transition = 'all 0.5s ease';
        header.style.opacity = '1';
        header.style.transform = 'translateY(0)';
    }, 100);
    
    // Animate graphs with staggered delay
    graphs.forEach((graph, index) => {
        graph.style.opacity = '0';
        graph.style.transform = 'translateY(20px)';
        setTimeout(() => {
            graph.style.transition = 'all 0.5s ease';
            graph.style.opacity = '1';
            graph.style.transform = 'translateY(0)';
        }, 300 + (index * 150));
    });
    
    // Animate projects container
    if (projectsContainer) {
        projectsContainer.style.opacity = '0';
        projectsContainer.style.transform = 'translateY(20px)';
        setTimeout(() => {
            projectsContainer.style.transition = 'all 0.5s ease';
            projectsContainer.style.opacity = '1';
            projectsContainer.style.transform = 'translateY(0)';
        }, 600);
    }
});

// Radar Chart Creation Functions
const createTechnicalSkillsRadar = (skillsData) => {
    const technicalSkills = [
        'skill_prog','skill_algo', 'skill_sys-admin',
        'skill_front-end','skill_back-end', 'skill_game', 'skill_tcp', 
    ];  
         
    
    const processedData = technicalSkills.map(skill => {
        const found = skillsData.find(d => d.type === skill);
        return {
            axis: skill.replace('skill_', '').replace('-', ' ').toUpperCase(),
            value: found ? found.amount : 0
        };
    });

    drawRadarChart('#technicalRadar', processedData, 'Technical Skills');
};

const createTechnologySkillsRadar = (skillsData) => {
    const technologySkills = [
        'skill_go', 'skill_js',  'skill_html',
         'skill_css', 'skill_unix','skill_docker',  'skill_sql',
    ];

    const processedData = technologySkills.map(skill => {
        const found = skillsData.find(d => d.type === skill);
        return {
            axis: skill.replace('skill_', '').toUpperCase(),
            value: found ? found.amount : 0
        };
    });

    drawRadarChart('#technologyRadar', processedData, 'Technology Skills');
};

const drawRadarChart = (containerSelector, data, title) => {
    const container = d3.select(containerSelector);
    container.selectAll("*").remove();

    const width = 450;
    const height = 398;
    const margin = { top: 50, right: 50, bottom: 50, left: 50 };
    const innerRadius = Math.min(width, height) * 0.4 - 10;

    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width/2 -5},${height/2})`);

    // Title
    svg.append('text')
        .attr('class', 'radar-title')
        .attr('text-anchor', 'middle')
        .attr('y', -height/2 + 393)
        .text(title);

    // Scales
    const maxValue = d3.max(data, d => d.value);
    const rScale = d3.scaleLinear()
        .domain([0, 100])
        .range([0, innerRadius]);

    // Create axes
    const axes = data.map(d => d.axis);
    const angleSlice = (Math.PI * 2) / axes.length;

    // Draw grid
    const levels = 5;
    const levelFactor = innerRadius / levels;

    for(let i = 0; i <= levels; i++) {
        const radius = levelFactor * i;
        
        svg.append('circle')
            .attr('r', radius)
            .style('fill', 'none')
            .style('stroke', '#94a3b8')
            .style('stroke-width', 0.5);

        svg.append('text')
            .attr('text-anchor', 'middle')
            .attr('y', -radius + 2)
            .text(Math.round(100 * (i/levels )))
            .style('font-size', '10px')
            .style('fill', '#64748b');
    }

    // Create axes lines
    axes.forEach((axis, i) => {
        const angle = angleSlice * i - Math.PI/2;
        const x = Math.cos(angle) * innerRadius;
        const y = Math.sin(angle) * innerRadius;

        // Axis Labels
        svg.append('text')
            .attr('text-anchor', 'middle')
            .attr('transform', `translate(${Math.cos(angle) * (innerRadius + 40)},${Math.sin(angle) * (innerRadius + 40)})`)
            .text(axis)
            .style('font-size', '12px')
            .style('fill', '#6448b')
            .style('text-shadow', '0 1px 0 #fff');
    });

    // Convert data into coordinates
    const radarPoints = data.map((d, i) => {
        const angle = angleSlice * i - Math.PI/2;
        return [
            Math.cos(angle) * rScale(d.value),
            Math.sin(angle) * rScale(d.value)
        ];
    });

    // Close the shape
    radarPoints.push(radarPoints[0]);

    // Create a line generator
    const line = d3.line()
        .x(d => d[0])
        .y(d => d[1])
        .curve(d3.curveLinearClosed);

    // Draw the shape
    svg.append('path')
        .datum(radarPoints)
        .attr('d', line)
        .style('fill', 'rgba(99, 102, 241, 0.2)')
        .style('stroke', '#6366f1')
        .style('stroke-width', 2)
        .style('opacity', 0)
        .transition()
        .duration(500)
        .style('opacity', 1);

    // Add data points
    svg.selectAll('.data-point')
        .data(data)
        .enter()
        .append('circle')
            .attr('r', 4)
            .attr('cx', (d, i) => Math.cos(angleSlice * i - Math.PI/2) * rScale(d.value))
            .attr('cy', (d, i) => Math.sin(angleSlice * i - Math.PI/2) * rScale(d.value))
            .style('fill', '#6366f1')
            .style('stroke', '#fff')
            .style('stroke-width', 2)
            .style('opacity', 0)
            .transition()
            .delay((d, i) => i * 50)
            .duration(200)
            .style('opacity', 1);
};


// Initialize
loadUserData();