    let mainChart = null;
    let detailChart = null;
    let globalData = null;
    let selectedNode = null;
    let linkCounts = {};
    let nodeDepths = {};
    let currentFile = null;
    let showLabels = true;

    // ✅ 初始化函数
    (function init() {
        // 创建图表实例
        mainChart = echarts.init(document.getElementById('main-network'));
        detailChart = echarts.init(document.getElementById('detail-tree'));
        
        // 添加事件监听
        document.getElementById('upload-btn').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });
        
        document.getElementById('file-input').addEventListener('change', handleFileSelect);
        document.getElementById('analyze-btn').addEventListener('click', analyzeData);
        document.getElementById('reset-btn').addEventListener('click', resetView);
        document.getElementById('expand-btn').addEventListener('click', expandTree);
        document.getElementById('collapse-btn').addEventListener('click', collapseTree);
        document.getElementById('layout-btn').addEventListener('click', optimizeLayout);
        document.getElementById('toggle-labels').addEventListener('click', toggleLabels);
        document.getElementById('search-btn').addEventListener('click', searchNode);
        document.querySelector('.close-detail').addEventListener('click', () => {
            document.getElementById('node-detail').style.display = 'none';
        });
        
        // 帮助模块事件
        document.getElementById('helpBtn').addEventListener('click', openHelpModal);
        document.getElementById('closeHelpBtn').addEventListener('click', closeHelpModal);
        document.getElementById('helpModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('helpModal')) {
                closeHelpModal();
            }
        });
        
        // 添加窗口自适应
        window.addEventListener('resize', () => {
            mainChart.resize();
            detailChart.resize();
        });
    })();

    // ✅ 打开帮助模态框
    function openHelpModal() {
        document.getElementById('helpModal').classList.add('active');
    }
    
    // ✅ 关闭帮助模态框
    function closeHelpModal() {
        document.getElementById('helpModal').classList.remove('active');
    }

    // ✅ 处理文件选择
    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            currentFile = file;
            document.getElementById('file-name').innerHTML = `<i class="fas fa-file-code"></i> ${file.name}`;
            document.getElementById('analyze-btn').disabled = false;
        }
    }

    // ✅ 分析数据
    function analyzeData() {
        if (!currentFile) return;
        
        showLoader();
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                
                // 验证数据结构
                if (!data.nodes || !data.links) {
                    throw new Error('无效的JSON格式: 缺少nodes或links属性');
                }
                
                globalData = data;
                
                // 计算节点连接数和深度
                calculateNodeMetrics();
                
                // 更新统计数据
                updateStats();
                
                // 渲染图表
                renderMainChart();
                
                // 默认选中第一个节点
                if (globalData.nodes.length > 0) {
                    selectedNode = globalData.nodes[0];
                    renderDetailTree(selectedNode);
                }
                
                // 启用控件
                document.getElementById('reset-btn').disabled = false;
                document.getElementById('layout-btn').disabled = false;
                document.getElementById('expand-btn').disabled = false;
                document.getElementById('collapse-btn').disabled = false;
                document.getElementById('search-btn').disabled = false;
                document.getElementById('search-input').disabled = false;
                
            } catch (error) {
                console.error('数据分析失败:', error);
                alert(`数据分析失败: ${error.message}`);
                hideLoader();
            }
        };
        
        reader.onerror = function() {
            alert('文件读取失败');
            hideLoader();
        };
        
        reader.readAsText(currentFile);
    }
    
    // ✅ 更新统计信息
    function updateStats() {
        document.getElementById('node-count').textContent = globalData.nodes.length;
        document.getElementById('link-count').textContent = globalData.links.length;
        
        const maxLinks = Math.max(...Object.values(linkCounts));
        document.getElementById('max-links').textContent = maxLinks;
        
        const depths = Object.values(nodeDepths).filter(d => d > 0);
        const avgDepth = depths.length ? (depths.reduce((a, b) => a + b, 0) / depths.length).toFixed(1) : 0;
        document.getElementById('avg-depth').textContent = avgDepth;
    }

    // ✅ 显示加载界面
    function showLoader() {
        document.getElementById('loader').style.display = 'flex';
        simulateProgress();
    }

    // ✅ 隐藏加载界面
    function hideLoader() {
        document.getElementById('loader').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loader').style.display = 'none';
            document.getElementById('loader').style.opacity = '1';
        }, 400);
    }

    // ✅ 模拟进度条
    function simulateProgress() {
        const progress = document.getElementById('progress');
        let width = 0;
        const interval = setInterval(() => {
            if (width >= 95) {
                clearInterval(interval);
                return;
            }
            width += 2;
            progress.style.width = `${width}%`;
        }, 80);
    }

    // ✅ 计算节点指标
    function calculateNodeMetrics() {
        // 重置指标
        linkCounts = {};
        nodeDepths = {};
        
        // 初始化
        globalData.nodes.forEach(node => {
            linkCounts[node.id] = 0;
            nodeDepths[node.id] = 0;
        });
        
        // 计算连接数
        globalData.links.forEach(link => {
            linkCounts[link.source]++;
            linkCounts[link.target]++;
        });
        
        // 计算节点深度（使用BFS）
        const nodeMap = new Map(globalData.nodes.map(n => [n.id, n]));
        
        globalData.nodes.forEach(node => {
            const visited = new Set();
            const queue = [{node: node, depth: 0}];
            let maxDepth = 0;
            
            while (queue.length > 0) {
                const {node, depth} = queue.shift();
                visited.add(node.id);
                maxDepth = Math.max(maxDepth, depth);
                
                // 获取所有关联节点
                const neighbors = [
                    ...globalData.links.filter(l => l.source === node.id).map(l => l.target),
                    ...globalData.links.filter(l => l.target === node.id).map(l => l.source)
                ];
                
                for (const neighborId of neighbors) {
                    if (!visited.has(neighborId)) {
                        const neighbor = nodeMap.get(neighborId);
                        if (neighbor) {
                            queue.push({node: neighbor, depth: depth + 1});
                        }
                    }
                }
            }
            
            nodeDepths[node.id] = maxDepth;
        });
    }

    // ✅ 重置视图
    function resetView() {
        if (globalData.nodes.length > 0) {
            selectedNode = globalData.nodes[0];
            renderDetailTree(selectedNode);
            mainChart.dispatchAction({ type: 'downplay' });
            mainChart.dispatchAction({
                type: 'highlight',
                seriesIndex: 0,
                dataIndex: [0]
            });
        }
    }

    // ✅ 优化布局
    function optimizeLayout() {
        mainChart.dispatchAction({
            type: 'forceLayout',
            animation: {
                duration: 1000,
                easing: 'cubicOut'
            }
        });
    }

    // ✅ 展开树状图
    function expandTree() {
        if (selectedNode) {
            renderDetailTree(selectedNode, true);
        }
    }
    
    // ✅ 折叠树状图
    function collapseTree() {
        if (selectedNode) {
            renderDetailTree(selectedNode, false);
        }
    }
    
    // ✅ 切换标签显示
    function toggleLabels() {
        showLabels = !showLabels;
        renderMainChart();
    }
    
    // ✅ 搜索节点
    function searchNode() {
        const keyword = document.getElementById('search-input').value.toLowerCase();
        if (!keyword || !globalData) return;
        
        const foundNode = globalData.nodes.find(node => 
            node.id.toLowerCase().includes(keyword) || 
            node.title.toLowerCase().includes(keyword)
        );
        
        if (foundNode) {
            // 高亮并选中节点
            selectedNode = foundNode;
            renderDetailTree(foundNode);
            highlightRelatedNodes(foundNode.id);
            
            // 高亮网络图中的节点
            const nodeIndex = globalData.nodes.findIndex(n => n.id === foundNode.id);
            mainChart.dispatchAction({
                type: 'highlight',
                seriesIndex: 0,
                dataIndex: [nodeIndex]
            });
            
            // 显示详情面板
            showNodeDetail(foundNode);
        } else {
            alert('未找到匹配的商品');
        }
    }
    
    // ✅ 显示节点详情
    function showNodeDetail(node) {
        document.getElementById('detail-title').textContent = node.title || '未知标题';
        document.getElementById('detail-asin').textContent = node.id || '未知ASIN';
        document.getElementById('detail-links').textContent = linkCounts[node.id] || 0;
        document.getElementById('detail-depth').textContent = nodeDepths[node.id] || 0;
        
        // 计算排名
        const nodesByLinks = [...globalData.nodes].sort((a, b) => linkCounts[b.id] - linkCounts[a.id]);
        const rank = nodesByLinks.findIndex(n => n.id === node.id) + 1;
        document.getElementById('detail-rank').textContent = rank;
        
        if (node.缩略图) {
            document.getElementById('detail-img').src = node.缩略图;
        }
        
        document.getElementById('node-detail').style.display = 'block';
    }

    // ✅ 主关系图配置（修复了节点重叠和tooltip问题）
    function renderMainChart() {
        // 计算节点连接数
        const maxLinks = Math.max(...Object.values(linkCounts));
        const minLinks = Math.min(...Object.values(linkCounts));
        
        // 动态计算排斥力，节点越多排斥力越大
        const repulsion = 400 + (globalData.nodes.length * 2);
        
        const option = {
            tooltip: {
                trigger: 'item',
                formatter: tooltipFormatter,
                backgroundColor: 'rgba(10, 15, 30, 0.95)',
                borderColor: '#3498db',
                borderWidth: 1,
                textStyle: {
                    color: '#ecf0f1'
                },
                padding: 0,
                extraCssText: 'box-shadow: 0 0 25px rgba(52, 152, 219, 0.5);'
            },
            series: [{
                type: 'graph',
                layout: 'force',
                force: {
                    // 增大排斥力避免节点重叠
                    repulsion: repulsion,
                    // 增加边长度，使节点间距离更大
                    edgeLength: 200,
                    gravity: 0.05,
                    friction: 0.1,
                    // 增加迭代次数使布局更稳定
                    iterations: 100
                },
                data: globalData.nodes.map(node => {
                    const links = linkCounts[node.id] || 0;
                    // 计算圆圈大小（基于连接数）
                    const size = 20 + (links / maxLinks) * 80;
                    
                    // 根据连接数设置颜色
                    let color;
                    if (links > maxLinks * 0.7) color = '#CC0C39';
                    else if (links > maxLinks * 0.4) color = '#2ecc71';
                    else color = '#888c8c';
                    
                    // 核心节点特殊标记
                    if (links > maxLinks * 0.8) color = '#ff6e21';
                    
                    // 计算节点重要度（0-1）
                    const importance = (links - minLinks) / (maxLinks - minLinks);
                    
                    return {
                        ...node,
                        value: links, // 存储连接数
                        symbolSize: size,
                        symbol: 'circle',
                        itemStyle: {
                            color: color,
                            borderColor: 'rgba(255, 255, 255, 0.6)',
                            borderWidth: 2,
                            shadowBlur: 10,
                            shadowColor: 'rgba(0, 0, 0, 0.3)'
                        },
                        label: {
                            show: showLabels,
                            position: 'inside',
                            fontSize: Math.max(10, 10 + importance * 8),
                            fontWeight: 'bold',
                            color: '#fff',
                            formatter: function(params) {
                                const words = params.data.title ? params.data.title.split(' ') : [];
                                return words.map(word => word.charAt(0)).join('');
                            }
                        },
                        emphasis: {
                            itemStyle: {
                                borderWidth: 4,
                                shadowBlur: 20,
                                shadowColor: 'rgba(52, 152, 219, 0.8)'
                            }
                        }
                    };
                }),
                links: globalData.links.map(link => ({
                    ...link,
                    lineStyle: {
                        color: 'rgba(127, 140, 141, 0.6)',
                        width: 1.5,
                        curveness: 0.2
                    }
                })),
                lineStyle: {
                    opacity: 0.8
                },
                emphasis: {
                    focus: 'adjacency',
                    lineStyle: {
                        width: 3,
                        color: '#3498db'
                    }
                },
                roam: true,
                draggable: true,
                animation: true,
                animationDuration: 1500,
                animationEasing: 'cubicOut'
            }]
        };
        
        mainChart.setOption(option);
        hideLoader();

        // 绑定点击事件
        mainChart.on('click', ({ data }) => {
            if (data) {
                selectedNode = data;
                renderDetailTree(data);
                highlightRelatedNodes(data.id);
                showNodeDetail(data);
            }
        });
        
        // 初始高亮第一个节点
        if (globalData.nodes.length > 0) {
            setTimeout(() => {
                mainChart.dispatchAction({
                    type: 'highlight',
                    seriesIndex: 0,
                    dataIndex: [0]
                });
            }, 500);
        }
    }

    // ✅ 生成详情树状图
    function renderDetailTree(selectedNode, expandAll = false) {
        const treeData = buildHierarchy(selectedNode, 3); // 3层深度

        const option = {
            tooltip: {
                formatter: tooltipFormatter,
                position: ['50%', '50%'],
                padding: 0,
                backgroundColor: 'rgba(10, 15, 30, 0.95)',
                borderColor: '#3498db',
                extraCssText: 'box-shadow: 0 0 25px rgba(52, 152, 219, 0.5);'
            },
            series: [{
                type: 'tree',
                data: [treeData],
                orient: 'vertical',
                initialTreeDepth: expandAll ? -1 : 1,
                expandAndCollapse: true,
                edgeShape: 'polyline',
                edgeForkPosition: '50%',
                label: {
                    position: 'left',
                    verticalAlign: 'middle',
                    align: 'right',
                    fontSize: 13,
                    color: '#ecf0f1',
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    padding: [4, 8],
                    borderRadius: 4,
                    formatter: ({ data }) => data.name.split(' ').slice(0, 3).join(' ')
                },
                leaves: {
                    label: {
                        position: 'right',
                        color: '#bdc3c7'
                    }
                },
                lineStyle: {
                    color: 'rgba(127, 140, 141, 0.6)',
                    width: 1.5,
                    curveness: 0.25
                },
                itemStyle: {
                    color: '#3498db',
                    borderColor: '#fff'
                },
                symbol: `image://${selectedNode.缩略图 || 'https://via.placeholder.com/40/2c3e50/ecf0f1?text=IMG'}`, 
                symbolSize: [40, 40],
                animationDuration: 800,
                roam: true
            }]
        };
        
        detailChart.setOption(option, true);
        
        // 更新标题
        document.querySelector('.tree-chart .chart-title span').innerHTML = 
            `<i class="fas fa-sitemap"></i> ${selectedNode.title ? selectedNode.title.split(' ').slice(0, 3).join(' ') : '未知商品'} 关联树`;
    }

    // ✅ 构建层级关系树
    function buildHierarchy(rootNode, maxDepth) {
        const nodeMap = new Map(globalData.nodes.map(n => [n.id, n]));
        const visited = new Set();

        function buildTree(currentNode, depth = 0) {
            if (depth >= maxDepth || visited.has(currentNode.id)) return null;
            visited.add(currentNode.id);

            const children = globalData.links
                .filter(link => link.source === currentNode.id)
                .map(link => {
                    const child = nodeMap.get(link.target);
                    return child ? buildTree(child, depth + 1) : null;
                })
                .filter(Boolean);

            return {
                name: currentNode.title || '未知商品',
                value: currentNode,
                children: children.length ? children : null,
                symbol: `image://${currentNode.缩略图 || 'https://via.placeholder.com/30/2c3e50/ecf0f1?text=IMG'}`,
                symbolSize: [30, 30],
                itemStyle: {
                    color: '#3498db'
                }
            };
        }

        return buildTree(rootNode);
    }

    // ✅ 高亮关联节点
    function highlightRelatedNodes(asin) {
        const relatedNodes = globalData.links
            .filter(link => link.source === asin || link.target === asin)
            .flatMap(link => [link.source, link.target])
            .filter(id => id !== asin);

        mainChart.dispatchAction({
            type: 'highlight',
            seriesIndex: 0,
            dataIndex: relatedNodes.map(id => 
                globalData.nodes.findIndex(n => n.id === id)
            )
        });
    }

// ✅ 统一工具提示格式化（同时支持主关系图和树状图）
function tooltipFormatter(params) {
    // 区分主图和树图的数据结构
    let rawData;
    let tooltipContent;
    
    if (params.seriesType === 'graph') {
        // 主关系图 - 数据直接存储在data中
        rawData = params.data;
        tooltipContent = generateTooltipHTML(rawData);
    } else if (params.seriesType === 'tree') {
        // 树状图 - 数据存储在data.value中
        rawData = params.data.value;
        tooltipContent = generateTooltipHTML(rawData);
    } else {
        // 默认处理
        rawData = params.data.value || params.data;
        tooltipContent = generateTooltipHTML(rawData);
    }
    
    return tooltipContent;
}

// ✅ 生成工具提示HTML内容
function generateTooltipHTML(rawData) {
    // 确保rawData存在，防止undefined错误
    if (!rawData) {
        rawData = {
            title: "未知商品",
            id: "未知ASIN",
            缩略图: 'https://via.placeholder.com/150/2c3e50/ecf0f1?text=No+Data'
        };
    }
    
    // 为可能缺失的属性提供默认值
    const title = rawData.title || '未知标题';
    const id = rawData.id || '未知ASIN';
    const thumbnail = rawData.缩略图 || 'https://via.placeholder.com/150/2c3e50/ecf0f1?text=No+Image';
    
    // 获取连接数和深度（使用全局存储的指标）
    const links = linkCounts[rawData.id] || 0;
    const depth = nodeDepths[rawData.id] || 0;

    return `
        <div style="
            padding: 20px;
            background: linear-gradient(135deg, #1a2a6c, #2c3e50);
            border-radius: 10px;
            min-width: 280px;
            border: 1px solid #3498db;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        ">
            <div style="text-align: center; margin-bottom: 15px;">
                <img src="${thumbnail}" 
                     style="width: 150px; height: 150px; border-radius: 8px; object-fit: cover; border: 2px solid #3498db;">
            </div>
            <div style="
                font-size: 18px;
                color: #ecf0f1;
                margin-bottom: 10px;
                font-weight: 600;
                text-align: center;
                line-height: 1.4;
            ">${title}</div>
            <div style="
                background: rgba(52, 152, 219, 0.2);
                padding: 10px;
                border-radius: 8px;
                text-align: center;
                margin-top: 15px;
            ">
                <div style="font-size: 16px; color: #3498db; font-weight: 600;">ASIN: ${id}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 15px;">
                <div style="text-align: center; flex: 1;">
                    <div style="font-size: 14px; color: #bdc3c7;">关联数量</div>
                    <div style="font-size: 24px; color: #2ecc71; font-weight: 700;">${links}</div>
                </div>
                <div style="text-align: center; flex: 1;">
                    <div style="font-size: 14px; color: #bdc3c7;">关联深度</div>
                    <div style="font-size: 24px; color: #f1c40f; font-weight: 700;">${depth}</div>
                </div>
            </div>
        </div>
    `;
}