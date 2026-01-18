import React, { useState } from 'react';
import { Upload, Plus, X, DollarSign, Users, Check } from 'lucide-react';

export default function ReceiptSplitter() {
  const [step, setStep] = useState('upload');
  const [receiptImage, setReceiptImage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [items, setItems] = useState([]);
  const [additionalCosts, setAdditionalCosts] = useState([]);
  const [totalPeople, setTotalPeople] = useState('');
  const [currentPerson, setCurrentPerson] = useState('');
  const [claimingForOther, setClaimingForOther] = useState(false);
  const [otherPersonName, setOtherPersonName] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [receiptDate, setReceiptDate] = useState('');
  const [shareableLink, setShareableLink] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [paymentConfirmed, setPaymentConfirmed] = useState({});
  const [receiptId, setReceiptId] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingClaims, setPendingClaims] = useState([]);
  const [optionalSharedItems, setOptionalSharedItems] = useState([]);
  const [viewerStatus, setViewerStatus] = useState({});
  const [lowConfidenceItems, setLowConfidenceItems] = useState([]);
  const [giftedItems, setGiftedItems] = useState([]);

  React.useEffect(() => {
    const loadReceiptData = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get('receipt');
      
      if (id) {
        setReceiptId(id);
        setLoading(true);
        try {
          const result = await window.storage.get(id, true);
          if (result) {
            const data = JSON.parse(result.value);
            setItems(data.items || []);
            setAdditionalCosts(data.additionalCosts || []);
            setTotalPeople(data.totalPeople || '');
            setRestaurantName(data.restaurantName || '');
            setReceiptDate(data.receiptDate || '');
            setCustomTitle(data.customTitle || '');
            setPaymentConfirmed(data.paymentConfirmed || {});
            setOptionalSharedItems(data.optionalSharedItems || []);
            setViewerStatus(data.viewerStatus || {});
            setGiftedItems(data.giftedItems || []);
            setStep('split');
          }
        } catch (error) {
          console.error('Error loading receipt:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    
    loadReceiptData();
  }, []);

  const saveReceiptData = async (updatedItems, updatedPayments, updatedViewers, updatedOptional, updatedGifted) => {
    if (!receiptId) return;
    
    try {
      const data = {
        items: updatedItems || items,
        additionalCosts,
        totalPeople,
        restaurantName,
        receiptDate,
        customTitle,
        paymentConfirmed: updatedPayments || paymentConfirmed,
        optionalSharedItems: updatedOptional !== undefined ? updatedOptional : optionalSharedItems,
        viewerStatus: updatedViewers || viewerStatus,
        giftedItems: updatedGifted !== undefined ? updatedGifted : giftedItems
      };
      await window.storage.set(receiptId, JSON.stringify(data), true);
    } catch (error) {
      console.error('Error saving receipt:', error);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      setReceiptImage(event.target.result);
      setAnalyzing(true);
      
      try {
     const response = await fetch('/.netlify/functions/analyze-receipt', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    imageData: event.target.result.split(',')[1],
    mediaType: file.type
  })
});

        const data = await response.json();
        const text = data.content.find(c => c.type === 'text')?.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          
          if (parsed.error || !parsed.items || parsed.items.length === 0) {
            alert('Sorry, we could not read this receipt clearly. Please try taking a clearer photo or entering items manually.');
            setAnalyzing(false);
            return;
          }
          
          const itemsWithTypes = parsed.items.map((item, idx) => ({ 
            ...item, 
            id: idx, 
            claimedBy: null,
            itemType: 'individual',
            confidence: item.confidence || 100
          }));
          
          const lowConf = itemsWithTypes.filter(item => item.confidence < 80);
          setLowConfidenceItems(lowConf);
          
          setItems(itemsWithTypes);
          setAdditionalCosts(parsed.additionalCosts || []);
          setRestaurantName(parsed.restaurantName || '');
          setReceiptDate(parsed.date || '');
          setStep('setup');
        }
      } catch (error) {
        console.error('Error:', error);
        alert('Error analyzing receipt. Please try again.');
      } finally {
        setAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const addAdditionalCost = (name, amount) => {
    if (name && amount) {
      const numAmount = parseFloat(amount);
      if (numAmount < 0) {
        alert('Amount cannot be negative');
        return;
      }
      if (numAmount > 9999) {
        alert('Amount seems too large. Maximum is $9,999');
        return;
      }
      setAdditionalCosts([...additionalCosts, { name, amount: numAmount }]);
    }
  };

  const removeAdditionalCost = (idx) => {
    setAdditionalCosts(additionalCosts.filter((_, i) => i !== idx));
  };

  const toggleItemType = (itemId) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        let newType = 'individual';
        if (item.itemType === 'individual') newType = 'sharedAll';
        else if (item.itemType === 'sharedAll') newType = 'sharedOptional';
        else newType = 'individual';
        return { ...item, itemType: newType };
      }
      return item;
    }));
  };

  const claimItem = (itemId) => {
    if (!currentPerson.trim()) {
      alert('Please enter your name first');
      return;
    }
    
    if (currentPerson.length > 30) {
      alert('Name is too long. Please use 30 characters or less');
      return;
    }
    
    if (claimingForOther && !otherPersonName.trim()) {
      alert('Please enter the other person name');
      return;
    }
    
    if (claimingForOther && otherPersonName.length > 30) {
      alert('Name is too long. Please use 30 characters or less');
      return;
    }
    
    const additionalPeople = claimingForOther ? 1 : 0;
    
    const newClaim = {
      id: itemId,
      claimedBy: currentPerson,
      additionalPeople,
      otherPerson: claimingForOther ? otherPersonName : null
    };
    
    setPendingClaims([...pendingClaims, newClaim]);
    
    if (!viewerStatus[currentPerson]) {
      const updated = { ...viewerStatus, [currentPerson]: 'viewing' };
      setViewerStatus(updated);
      saveReceiptData(null, null, updated, undefined);
    }
  };

  const unclaimPendingItem = (itemId) => {
    setPendingClaims(pendingClaims.filter(claim => claim.id !== itemId));
  };

  const confirmClaims = async () => {
    if (pendingClaims.length === 0 && optionalSharedItems.length === 0) {
      alert('Please claim some items or select optional shared items');
      return;
    }

    const updatedItems = items.map(item => {
      const claim = pendingClaims.find(c => c.id === item.id);
      if (claim) {
        return {
          ...item,
          claimedBy: claim.claimedBy,
          additionalPeople: claim.additionalPeople,
          otherPerson: claim.otherPerson
        };
      }
      return item;
    });
    
    setItems(updatedItems);
    
    // Mark as confirmed
    const updatedViewers = { ...viewerStatus, [currentPerson]: 'confirmed' };
    setViewerStatus(updatedViewers);
    
    await saveReceiptData(updatedItems, null, updatedViewers, optionalSharedItems);
    setPendingClaims([]);
    alert('Items claimed successfully!');
  };

  const unclaimItem = (itemId) => {
    const item = items.find(i => i.id === itemId);
    if (item && paymentConfirmed[item.claimedBy]) {
      if (!confirm('This person already marked their payment as complete. Are you sure you want to unclaim this item?')) {
        return;
      }
    }
    
    const updatedItems = items.map(item => 
      item.id === itemId ? { ...item, claimedBy: null, additionalPeople: 0, otherPerson: null } : item
    );
    
    setItems(updatedItems);
    saveReceiptData(updatedItems, null, null, undefined);
  };

  const toggleOptionalItem = (itemId, person, includeOther) => {
    const existing = optionalSharedItems.find(
      opt => opt.itemId === itemId && opt.person === person && opt.isOtherPerson === includeOther
    );
    
    let updated;
    if (existing) {
      updated = optionalSharedItems.filter(
        opt => !(opt.itemId === itemId && opt.person === person && opt.isOtherPerson === includeOther)
      );
    } else {
      updated = [...optionalSharedItems, { itemId, person, isOtherPerson: includeOther }];
    }
    
    setOptionalSharedItems(updated);
  };

  const giftSharedItem = (itemId, gifterName) => {
    const item = items.find(i => i.id === itemId);
    if (!item || item.itemType !== 'sharedAll') return;
    
    const alreadyGifted = giftedItems.find(g => g.itemId === itemId);
    if (alreadyGifted) {
      alert(`This item is already being covered by ${alreadyGifted.gifter}`);
      return;
    }
    
    if (!gifterName.trim()) {
      alert('Please enter your name first');
      return;
    }
    
    const confirmMsg = `You'll cover the full ${item.price.toFixed(2)} for "${item.name}". Everyone else will pay $0 for it. Continue?`;
    if (!confirm(confirmMsg)) return;
    
    const updated = [...giftedItems, { itemId, gifter: gifterName }];
    setGiftedItems(updated);
    saveReceiptData(null, null, null, undefined, updated);
    alert(`Thanks for covering this! Everyone will see it's covered by you. 🎁`);
  };

  const ungiftSharedItem = (itemId) => {
    const gift = giftedItems.find(g => g.itemId === itemId);
    if (!gift) return;
    
    if (!confirm('Remove your gift? This will add the cost back to everyone\'s totals.')) return;
    
    const updated = giftedItems.filter(g => g.itemId !== itemId);
    setGiftedItems(updated);
    saveReceiptData(null, null, null, undefined, updated);
  };

  const calculatePersonTotal = (person) => {
    const personItems = items.filter(item => item.claimedBy === person && item.itemType === 'individual');
    const itemsSubtotal = personItems.reduce((sum, item) => sum + item.price, 0);
    
    const totalAdditionalCosts = additionalCosts.reduce((sum, cost) => sum + cost.amount, 0);
    const totalPeopleNum = parseInt(totalPeople) || 1;
    
    const hasOtherPerson = personItems.some(item => item.additionalPeople > 0);
    const peopleThisPersonIsPayingFor = hasOtherPerson ? 2 : 1;
    
    const additionalCostShare = (totalAdditionalCosts / totalPeopleNum) * peopleThisPersonIsPayingFor;
    
    // Calculate shared by all items
    const sharedAllItems = items.filter(item => item.itemType === 'sharedAll');
    let sharedAllTotal = 0;
    let giftedByMeTotal = 0;
    
    sharedAllItems.forEach(item => {
      const gift = giftedItems.find(g => g.itemId === item.id);
      if (gift) {
        if (gift.gifter === person) {
          // This person is covering it
          giftedByMeTotal += item.price;
        }
        // If someone else is covering, cost is $0 for everyone else
      } else {
        // Not gifted, split normally
        sharedAllTotal += (item.price / totalPeopleNum) * peopleThisPersonIsPayingFor;
      }
    });
    
    // Calculate optional shared items
    const personOptionalItems = optionalSharedItems.filter(opt => opt.person === person);
    let optionalShare = 0;
    
    items.filter(item => item.itemType === 'sharedOptional').forEach(item => {
      const participants = optionalSharedItems.filter(opt => opt.itemId === item.id);
      const participantCount = participants.length;
      
      if (participantCount > 0) {
        const perPersonCost = item.price / participantCount;
        const thisPersonCount = participants.filter(opt => opt.person === person).length;
        optionalShare += perPersonCost * thisPersonCount;
      }
    });
    
    return {
      subtotal: itemsSubtotal,
      additionalCosts: additionalCostShare,
      sharedAll: sharedAllTotal,
      sharedOptional: optionalShare,
      giftedByMe: giftedByMeTotal,
      total: itemsSubtotal + additionalCostShare + sharedAllTotal + optionalShare + giftedByMeTotal,
      peopleCount: peopleThisPersonIsPayingFor
    };
  };

  const handleMarkAsPaid = (person) => {
    const updated = Object.assign({}, paymentConfirmed);
    updated[person] = true;
    setPaymentConfirmed(updated);
    saveReceiptData(null, updated, null, undefined);
  };

  // Calculate pending total
  let pendingTotal = null;
  if (pendingClaims.length > 0 || optionalSharedItems.filter(opt => opt.person === currentPerson).length > 0 || currentPerson) {
    const itemsSubtotal = pendingClaims.reduce((sum, claim) => {
      const item = items.find(i => i.id === claim.id);
      return sum + (item ? item.price : 0);
    }, 0);
    
    const totalAdditionalCosts = additionalCosts.reduce((sum, cost) => sum + cost.amount, 0);
    const totalPeopleNum = parseInt(totalPeople) || 1;
    
    const hasOtherPerson = pendingClaims.some(claim => claim.additionalPeople > 0);
    const peopleThisPersonIsPayingFor = hasOtherPerson ? 2 : 1;
    
    const additionalCostShare = (totalAdditionalCosts / totalPeopleNum) * peopleThisPersonIsPayingFor;
    
    // Shared by all
    const sharedAllItems = items.filter(item => item.itemType === 'sharedAll');
    let sharedAllShare = 0;
    let giftedByMeTotal = 0;
    
    sharedAllItems.forEach(item => {
      const gift = giftedItems.find(g => g.itemId === item.id);
      if (gift) {
        if (gift.gifter === currentPerson) {
          giftedByMeTotal += item.price;
        }
      } else {
        sharedAllShare += (item.price / totalPeopleNum) * peopleThisPersonIsPayingFor;
      }
    });
    
    // Optional shared
    let optionalShare = 0;
    items.filter(item => item.itemType === 'sharedOptional').forEach(item => {
      const allParticipants = optionalSharedItems.filter(opt => opt.itemId === item.id);
      const participantCount = allParticipants.length;
      
      if (participantCount > 0) {
        const perPersonCost = item.price / participantCount;
        const thisPersonCount = allParticipants.filter(opt => opt.person === currentPerson).length;
        optionalShare += perPersonCost * thisPersonCount;
      }
    });
    
    pendingTotal = {
      subtotal: itemsSubtotal,
      additionalCosts: additionalCostShare,
      sharedAll: sharedAllShare,
      sharedOptional: optionalShare,
      giftedByMe: giftedByMeTotal,
      total: itemsSubtotal + additionalCostShare + sharedAllShare + optionalShare + giftedByMeTotal,
      peopleCount: peopleThisPersonIsPayingFor
    };
  }

  const unclaimedItems = items.filter(item => {
    const alreadyClaimed = item.claimedBy;
    const pendingClaim = pendingClaims.find(c => c.id === item.id);
    const isIndividual = item.itemType === 'individual';
    return !alreadyClaimed && !pendingClaim && isIndividual;
  });
  const claimedItems = items.filter(item => item.claimedBy && item.itemType === 'individual');
  const uniquePeople = [...new Set(items.filter(item => item.claimedBy).map(item => item.claimedBy))];
  const displayTitle = customTitle || restaurantName || 'My Receipt';
  const allItemsClaimed = items.filter(i => i.itemType === 'individual').length > 0 && unclaimedItems.length === 0;
  
  const optionalItems = items.filter(item => item.itemType === 'sharedOptional');
  const sharedAllItems = items.filter(item => item.itemType === 'sharedAll');
  
  // Generate viewer status display
  const viewerList = [];
  const confirmedPeople = Object.keys(viewerStatus).filter(name => viewerStatus[name] === 'confirmed');
  const viewingPeople = Object.keys(viewerStatus).filter(name => viewerStatus[name] === 'viewing');
  const totalPeopleInt = parseInt(totalPeople) || 0;
  const unnamedCount = totalPeopleInt - Object.keys(viewerStatus).length;
  
  confirmedPeople.forEach(name => viewerList.push({ name, status: 'confirmed' }));
  viewingPeople.forEach(name => viewerList.push({ name, status: 'viewing' }));
  for (let i = 0; i < unnamedCount; i++) {
    const friendlyNames = ['Friend', 'Buddy', 'Pal', 'Mate', 'Amigo'];
    viewerList.push({ name: friendlyNames[i % friendlyNames.length] + ' #' + (i + 1), status: 'not-viewed' });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
          <p className="text-gray-600">Loading receipt...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl p-8 mb-6 border border-purple-100">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-fuchsia-600 rounded-2xl flex items-center justify-center shadow-lg">
              <DollarSign className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
                FairShare
              </h1>
              <p className="text-gray-600">Split bills instantly with friends</p>
            </div>
          </div>
        </div>

        {step === 'upload' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl shadow-xl p-6 border border-purple-100">
              <h2 className="text-xl font-bold mb-4 text-gray-800">How It Works</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 text-purple-600 font-bold">1</div>
                  <div>
                    <div className="font-semibold text-gray-800">Upload Receipt</div>
                    <div className="text-sm text-gray-600">Take a photo or upload your receipt image</div>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 text-purple-600 font-bold">2</div>
                  <div>
                    <div className="font-semibold text-gray-800">Review & Post</div>
                    <div className="text-sm text-gray-600">Verify items and costs, then make it live</div>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 text-purple-600 font-bold">3</div>
                  <div>
                    <div className="font-semibold text-gray-800">Friends Claim Items</div>
                    <div className="text-sm text-gray-600">Share the link - everyone claims what they ordered</div>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 text-purple-600 font-bold">4</div>
                  <div>
                    <div className="font-semibold text-gray-800">Get Paid</div>
                    <div className="text-sm text-gray-600">Everyone pays via Venmo - done!</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-xl p-8 border border-purple-100">
              <div className="border-2 border-dashed border-purple-300 rounded-2xl p-12 text-center hover:border-purple-500 hover:bg-purple-50 transition-all">
                <Upload className="w-16 h-16 mx-auto mb-4 text-purple-400" />
                <h3 className="text-xl font-semibold mb-2 text-gray-800">Upload Your Receipt</h3>
                <p className="text-gray-600 mb-4">Get started by uploading a photo</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="receipt-upload"
                />
                <label
                  htmlFor="receipt-upload"
                  className="inline-block bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white px-8 py-3 rounded-xl cursor-pointer hover:shadow-lg transition-all font-semibold"
                >
                  Choose File
                </label>
              </div>
              {analyzing && (
                <div className="mt-6 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  <p className="mt-2 text-gray-600">Analyzing receipt...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'setup' && (
          <div className="bg-white rounded-3xl shadow-xl p-6 border border-purple-100">
            <div className="mb-6 p-5 bg-gradient-to-r from-purple-50 to-fuchsia-50 rounded-2xl border-2 border-purple-200">
              <label className="block text-sm font-medium mb-2 text-gray-700">Receipt Title</label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder={restaurantName || "Enter a title (e.g., Team Lunch)"}
                className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg"
              />
              <div className="text-sm text-gray-600 mt-2">Date: {receiptDate || 'Not specified'}</div>
            </div>

            <h2 className="text-2xl font-bold mb-2">Review Your Receipt</h2>
            <p className="text-gray-600 mb-6">
              Great! We've extracted all the items from your receipt. Please review everything below, add any missing costs, 
              and tell us how many people are splitting the bill. Once you're ready, we'll make it live for everyone to claim their items!
            </p>
            
            {lowConfidenceItems.length > 0 && (
              <div className="mb-6 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-xl">
                <div className="font-bold text-yellow-800 mb-2">⚠️ Please Verify These Items</div>
                <div className="text-sm text-yellow-700 mb-3">
                  We're not completely confident about these items. Please double-check the names and prices:
                </div>
                <div className="space-y-2">
                  {lowConfidenceItems.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-2 bg-white rounded">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-yellow-700">${item.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="mb-6 p-4 bg-purple-50 rounded-xl border-2 border-purple-200">
              <label className="block text-sm font-medium mb-2">How many people are splitting this bill?</label>
              <input
                type="number"
                min="2"
                max="20"
                value={totalPeople}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || (parseInt(val) >= 2 && parseInt(val) <= 20)) {
                    setTotalPeople(val);
                  }
                }}
                placeholder="Enter number (2-20)"
                className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg"
              />
              <p className="text-sm text-gray-600 mt-2">Minimum 2 people, maximum 20 people. Additional costs will be split evenly.</p>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold mb-3">Detected Items ({items.length})</h3>
              <p className="text-sm text-gray-600 mb-3">
                Click on items to change how they're split: Individual → Shared by Everyone → Optional Shared
              </p>
              {items.length === 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center">
                  <p className="text-red-700 font-medium">No items detected on receipt</p>
                  <p className="text-sm text-red-600 mt-1">Please try a clearer photo or add items manually below</p>
                </div>
              )}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {items.map(item => {
                  let badge = '';
                  let badgeColor = '';
                  if (item.itemType === 'sharedAll') {
                    badge = 'Shared by All';
                    badgeColor = 'bg-blue-100 text-blue-700';
                  } else if (item.itemType === 'sharedOptional') {
                    badge = 'Optional Shared';
                    badgeColor = 'bg-amber-100 text-amber-700';
                  } else {
                    badge = 'Individual';
                    badgeColor = 'bg-gray-100 text-gray-700';
                  }
                  
                  const isLowConfidence = item.confidence < 80;
                  
                  return (
                    <div 
                      key={item.id} 
                      onClick={() => toggleItemType(item.id)}
                      className={'flex justify-between items-center p-3 rounded-xl border cursor-pointer hover:shadow-md transition-all ' + 
                        (isLowConfidence ? 'bg-yellow-50 border-yellow-300' : 'bg-purple-50 border-purple-100')}
                    >
                      <div className="flex items-center gap-3">
                        <span>{item.name}</span>
                        <span className={'text-xs px-2 py-1 rounded-full font-medium ' + badgeColor}>
                          {badge}
                        </span>
                        {isLowConfidence && (
                          <span className="text-xs px-2 py-1 rounded-full font-medium bg-yellow-200 text-yellow-800">
                            Verify
                          </span>
                        )}
                      </div>
                      <span className="font-semibold text-purple-600">${item.price.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold mb-2">Additional Costs</h3>
              <p className="text-sm text-gray-600 mb-3">
                If tip, delivery fee, or any other charges weren't detected on the receipt, please add them here!
              </p>
              {additionalCosts.length > 0 ? (
                <div className="space-y-2 mb-3">
                  {additionalCosts.map((cost, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                      <span className="font-medium">{cost.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">${cost.amount.toFixed(2)}</span>
                        <button onClick={() => removeAdditionalCost(idx)} className="text-red-500 hover:text-red-700">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm mb-3">No additional costs detected</p>
              )}
              
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Cost name"
                  id="new-cost-name"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  id="new-cost-amount"
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
                />
                <button
                  onClick={() => {
                    const nameEl = document.getElementById('new-cost-name');
                    const amountEl = document.getElementById('new-cost-amount');
                    if (nameEl && amountEl && nameEl.value && amountEl.value) {
                      addAdditionalCost(nameEl.value, amountEl.value);
                      nameEl.value = '';
                      amountEl.value = '';
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                if (!totalPeople || parseInt(totalPeople) < 2) {
                  alert('Please enter the number of people (minimum 2)');
                  return;
                }
                if (parseInt(totalPeople) > 20) {
                  alert('Maximum 20 people per receipt');
                  return;
                }
                if (items.length === 0) {
                  alert('Please add at least one item before going live');
                  return;
                }
                
                const totalAmount = items.reduce((sum, item) => sum + item.price, 0) + 
                                   additionalCosts.reduce((sum, cost) => sum + cost.amount, 0);
                if (totalAmount > 9999) {
                  alert('Total receipt amount exceeds $9,999 limit');
                  return;
                }
                
                const id = 'receipt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                setReceiptId(id);
                const link = window.location.origin + window.location.pathname + '?receipt=' + id;
                setShareableLink(link);
                
                const data = {
                  items,
                  additionalCosts,
                  totalPeople,
                  restaurantName,
                  receiptDate,
                  customTitle,
                  paymentConfirmed: {},
                  optionalSharedItems: [],
                  viewerStatus: {},
                  giftedItems: []
                };
                window.storage.set(id, JSON.stringify(data), true);
                
                setStep('split');
              }}
              className="w-full bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white py-4 rounded-xl font-bold hover:shadow-xl transition-all text-lg"
            >
              Make Receipt LIVE
            </button>
          </div>
        )}

        {step === 'split' && (
          <div className="space-y-6">
            {allItemsClaimed && pendingClaims.length === 0 && (
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-3xl shadow-xl p-6">
                <div className="flex items-center gap-3">
                  <Check className="w-8 h-8" />
                  <div>
                    <div className="font-bold text-xl">All Items Claimed!</div>
                    <div className="text-green-100">Check payments below.</div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-3xl shadow-xl p-6 border border-purple-100">
              <div className="mb-4 p-5 bg-gradient-to-r from-purple-50 to-fuchsia-50 rounded-2xl border-2 border-purple-200">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1">
                    <div className="font-bold text-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
                      {displayTitle}
                    </div>
                    <div className="text-sm text-gray-600">{receiptDate}</div>
                  </div>
                  <div className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full text-sm font-bold shadow-lg">
                    LIVE
                  </div>
                </div>

                <div className="mb-4 p-4 bg-white rounded-xl border border-purple-200">
                  <div className="font-semibold mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-600" />
                    Claim Status ({confirmedPeople.length} of {totalPeople} confirmed)
                  </div>
                  <div className="space-y-2">
                    {viewerList.map((viewer, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        {viewer.status === 'confirmed' && (
                          <>
                            <Check className="w-4 h-4 text-green-600" />
                            <span className="text-green-700 font-medium">{viewer.name} - Claimed & Confirmed</span>
                          </>
                        )}
                        {viewer.status === 'viewing' && (
                          <>
                            <div className="w-4 h-4 rounded-full border-2 border-yellow-500 animate-pulse"></div>
                            <span className="text-yellow-700 font-medium">{viewer.name} - Viewing now...</span>
                          </>
                        )}
                        {viewer.status === 'not-viewed' && (
                          <>
                            <div className="w-4 h-4 rounded-full border-2 border-gray-300"></div>
                            <span className="text-gray-500">{viewer.name} - Not yet viewed</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200">
                  <div className="text-sm font-bold mb-2 text-blue-900">Share with friends:</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={shareableLink}
                      readOnly
                      className="flex-1 px-4 py-2 bg-white border-2 border-blue-200 rounded-xl text-sm"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(shareableLink);
                        alert('Link copied!');
                      }}
                      className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:shadow-lg text-sm font-bold"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-bold mb-4">Claim Your Items</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Your name</label>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={currentPerson}
                    onChange={(e) => setCurrentPerson(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl text-lg"
                  />
                </div>
                
                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={claimingForOther}
                      onChange={(e) => {
                        setClaimingForOther(e.target.checked);
                        if (!e.target.checked) setOtherPersonName('');
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium">Claiming for someone else too?</div>
                      <div className="text-sm text-gray-600">Check if paying for another person</div>
                    </div>
                  </label>
                  
                  {claimingForOther && (
                    <input
                      type="text"
                      placeholder="Their name"
                      value={otherPersonName}
                      onChange={(e) => setOtherPersonName(e.target.value)}
                      className="w-full mt-3 px-4 py-2 border-2 border-purple-200 rounded-xl"
                    />
                  )}
                </div>
              </div>
            </div>

            {unclaimedItems.length > 0 && (
              <div className="bg-white rounded-3xl shadow-xl p-6 border border-purple-100">
                <h3 className="text-xl font-bold mb-4 text-gray-700">Available Items ({unclaimedItems.length})</h3>
                <div className="space-y-2">
                  {unclaimedItems.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-4 bg-gradient-to-r from-gray-50 to-purple-50 rounded-xl hover:shadow-md transition-all border border-purple-100">
                      <div>
                        <span className="font-medium">{item.name}</span>
                        <span className="ml-3 text-purple-600 font-bold">${item.price.toFixed(2)}</span>
                      </div>
                      <button
                        onClick={() => claimItem(item.id)}
                        className="px-5 py-2 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold"
                      >
                        Add to My Items
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sharedAllItems.length > 0 && (
              <div className="bg-white rounded-3xl shadow-xl p-6 border border-purple-100">
                <h3 className="text-xl font-bold mb-2 text-blue-700">Shared by Everyone</h3>
                <p className="text-sm text-gray-600 mb-4">
                  These items are automatically split equally among all {totalPeople} people.
                </p>
                <div className="space-y-3">
                  {sharedAllItems.map(item => {
                    const gift = giftedItems.find(g => g.itemId === item.id);
                    const isMyGift = gift && gift.gifter === currentPerson;
                    
                    return (
                      <div key={item.id} className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-semibold">{item.name}</div>
                            <div className="text-sm text-gray-600">
                              Total: ${item.price.toFixed(2)}
                              {!gift && ` (${(item.price / parseInt(totalPeople)).toFixed(2)} per person)`}
                            </div>
                          </div>
                          {gift && (
                            <span className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                              🎁 Covered by {gift.gifter}
                            </span>
                          )}
                        </div>
                        {!gift && currentPerson && (
                          <button
                            onClick={() => giftSharedItem(item.id, currentPerson)}
                            className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                          >
                            🎁 I'll cover this for everyone
                          </button>
                        )}
                        {isMyGift && (
                          <button
                            onClick={() => ungiftSharedItem(item.id)}
                            className="text-sm text-red-600 hover:text-red-800 font-medium"
                          >
                            ✕ Undo gift
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {optionalItems.length > 0 && (
              <div className="bg-white rounded-3xl shadow-xl p-6 border border-purple-100">
                <h3 className="text-xl font-bold mb-2 text-amber-700">Optional Shared Items</h3>
                <p className="text-sm text-gray-600 mb-4">
                  These items were shared by some people at the table. Check the boxes for items you participated in.
                </p>
                <div className="space-y-3">
                  {optionalItems.map(item => {
                    const myOptIn = optionalSharedItems.some(opt => opt.itemId === item.id && opt.person === currentPerson && !opt.isOtherPerson);
                    const otherOptIn = claimingForOther && optionalSharedItems.some(opt => opt.itemId === item.id && opt.person === currentPerson && opt.isOtherPerson);
                    
                    return (
                      <div key={item.id} className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-semibold">{item.name}</div>
                            <div className="text-sm text-gray-600">Total: ${item.price.toFixed(2)}</div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={myOptIn}
                              onChange={() => toggleOptionalItem(item.id, currentPerson, false)}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">I participated in this</span>
                          </label>
                          {claimingForOther && otherPersonName && (
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={otherOptIn}
                                onChange={() => toggleOptionalItem(item.id, currentPerson, true)}
                                className="w-4 h-4"
                              />
                              <span className="text-sm">{otherPersonName} participated in this</span>
                            </label>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(pendingClaims.length > 0 || optionalSharedItems.filter(opt => opt.person === currentPerson).length > 0) && (
              <div className="bg-white rounded-3xl shadow-xl p-6 border-2 border-yellow-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-yellow-700">My Items (Pending Confirmation)</h3>
                  <div className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-bold">
                    Not Saved Yet
                  </div>
                </div>
                
                <div className="space-y-2 mb-4">
                  {pendingClaims.map(claim => {
                    const item = items.find(i => i.id === claim.id);
                    if (!item) return null;
                    return (
                      <div key={claim.id} className="flex justify-between items-center p-3 bg-yellow-50 rounded-xl border border-yellow-200">
                        <div className="flex items-center gap-2">
                          <span>
                            {item.name}
                            {claim.otherPerson && (
                              <span className="text-sm text-purple-600 ml-2 font-medium">
                                (+ {claim.otherPerson})
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-yellow-700">${item.price.toFixed(2)}</span>
                          <button
                            onClick={() => unclaimPendingItem(claim.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {pendingTotal && (
                  <div className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-yellow-200">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Your items:</span>
                        <span className="font-semibold">${pendingTotal.subtotal.toFixed(2)}</span>
                      </div>
                      {pendingTotal.sharedAll > 0 && (
                        <div className="flex justify-between">
                          <span>Shared items (split equally):</span>
                          <span className="font-semibold">+${pendingTotal.sharedAll.toFixed(2)}</span>
                        </div>
                      )}
                      {pendingTotal.giftedByMe > 0 && (
                        <div className="flex justify-between text-green-700">
                          <span>🎁 Shared items you're covering:</span>
                          <span className="font-semibold">+${pendingTotal.giftedByMe.toFixed(2)}</span>
                        </div>
                      )}
                      {pendingTotal.sharedOptional > 0 && (
                        <div className="flex justify-between">
                          <span>Optional shared items:</span>
                          <span className="font-semibold">+${pendingTotal.sharedOptional.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="mt-2 mb-2">
                        <div className="flex justify-between text-gray-600 font-medium mb-1">
                          <span>Your share of additional costs:</span>
                          <span>+${pendingTotal.additionalCosts.toFixed(2)}</span>
                        </div>
                        <div className="ml-4 space-y-1 text-xs text-gray-500">
                          {additionalCosts.map((cost, idx) => {
                            const perPerson = cost.amount / parseInt(totalPeople);
                            const share = perPerson * pendingTotal.peopleCount;
                            return (
                              <div key={idx} className="flex justify-between">
                                <span>{cost.name} (${perPerson.toFixed(2)}/person x {pendingTotal.peopleCount}):</span>
                                <span>${share.toFixed(2)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex justify-between text-lg font-bold pt-2 border-t-2 border-yellow-200">
                        <span>Total to pay:</span>
                        <span className="text-yellow-700">${pendingTotal.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={confirmClaims}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 rounded-xl font-bold hover:shadow-xl transition-all text-lg"
                >
                  Confirm My Items & Save
                </button>
                <p className="text-sm text-center text-gray-600 mt-2">
                  Click to save your items so others can see what you have claimed
                </p>
              </div>
            )}

            {claimedItems.length > 0 && (
              <div className="bg-white rounded-3xl shadow-xl p-6 border border-purple-100">
                <h3 className="text-xl font-bold mb-4 text-green-700">Claimed Items ({claimedItems.length})</h3>
                
                {uniquePeople.map(person => {
                  const personItems = claimedItems.filter(item => item.claimedBy === person);
                  if (personItems.length === 0) return null;
                  
                  const totals = calculatePersonTotal(person);
                  const isPaid = paymentConfirmed[person];
                  
                  return (
                    <div key={person} className="mb-6 p-5 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-semibold text-lg flex items-center gap-2">
                          <Users className="w-5 h-5" />
                          <span>{person}</span>
                          {totals.peopleCount > 1 && (
                            <span className="text-sm font-normal text-gray-600">
                              (paying for {totals.peopleCount} people)
                            </span>
                          )}
                        </h4>
                        {isPaid && (
                          <div className="px-3 py-1 bg-green-500 text-white rounded-full text-xs font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            PAID
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        {personItems.map(item => (
                          <div key={item.id} className="flex justify-between items-center p-3 bg-white rounded-xl shadow-sm border border-green-100">
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-green-600" />
                              <span>
                                {item.name}
                                {item.otherPerson && (
                                  <span className="text-sm text-purple-600 ml-2 font-medium">
                                    (+ {item.otherPerson})
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-green-700">${item.price.toFixed(2)}</span>
                              <button
                                onClick={() => unclaimItem(item.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-green-100">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Your items:</span>
                            <span className="font-semibold">${totals.subtotal.toFixed(2)}</span>
                          </div>
                          {totals.sharedAll > 0 && (
                            <div className="flex justify-between">
                              <span>Shared items (split equally):</span>
                              <span className="font-semibold">+${totals.sharedAll.toFixed(2)}</span>
                            </div>
                          )}
                          {totals.giftedByMe > 0 && (
                            <div className="flex justify-between text-green-700">
                              <span>🎁 Shared items you're covering:</span>
                              <span className="font-semibold">+${totals.giftedByMe.toFixed(2)}</span>
                            </div>
                          )}
                          {totals.sharedOptional > 0 && (
                            <div className="flex justify-between">
                              <span>Optional shared items:</span>
                              <span className="font-semibold">+${totals.sharedOptional.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="mt-2 mb-2">
                            <div className="flex justify-between text-gray-600 font-medium mb-1">
                              <span>Your share of additional costs:</span>
                              <span>+${totals.additionalCosts.toFixed(2)}</span>
                            </div>
                            <div className="ml-4 space-y-1 text-xs text-gray-500">
                              {additionalCosts.map((cost, idx) => {
                                const perPerson = cost.amount / parseInt(totalPeople);
                                const share = perPerson * totals.peopleCount;
                                return (
                                  <div key={idx} className="flex justify-between">
                                    <span>{cost.name} (${perPerson.toFixed(2)}/person x {totals.peopleCount}):</span>
                                    <span>${share.toFixed(2)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <div className="flex justify-between text-lg font-bold pt-2 border-t-2 border-green-200">
                            <span>Total to pay:</span>
                            <span className="text-green-600">${totals.total.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        {!isPaid ? (
                          <div className="space-y-2">
                            <a
                              href={'https://venmo.com/?txn=pay&amount=' + totals.total.toFixed(2)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-full text-center bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-xl hover:shadow-xl font-bold"
                            >
                              Pay ${totals.total.toFixed(2)} with Venmo
                            </a>
                            <button
                              onClick={() => handleMarkAsPaid(person)}
                              className="block w-full text-center bg-gray-200 text-gray-700 py-2 rounded-xl hover:bg-gray-300 font-medium text-sm"
                            >
                              Mark as Paid
                            </button>
                          </div>
                        ) : (
                          <div className="text-center py-3 bg-green-100 text-green-800 rounded-xl font-semibold">
                            Payment Confirmed
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
