const calcFunds = (price, artistAmount, protocolFeeDenominator, protocolFeeNumerator, method) => {
  // Method that calculates the funds involved for a sale
  // price: listing price
  // artistAmount: amount of funds the artist will receive
  // protocolFeeDenominator: denominator of the protocol fee
  // protocolFeeNumerator: numerator of the protocol fee
  // method: the method that will be called to calculate the funds, one of hammer of inclusive
  //    when hammer, then the price does not include the protocol fee and artistAmount
  //    when inclusive, then the price includes the protocol fee and artistAmount
  // returns 4 BNs
  //   artistAmountBN - the amount of funds the artist will receive
  //   protocolFeeBN - the protocol fee
  //   sellerAmountBN - the amount of funds the seller will receive
  //   buyerAmountBN - the amount of funds the buyer needs to pay

  let artistAmountBN = new web3.utils.BN(artistAmount);
  let priceBN = new web3.utils.BN(price);
  let protocolFeeDenominatorBN = new web3.utils.BN(protocolFeeDenominator);
  let protocolFeeNumeratorBN = new web3.utils.BN(protocolFeeNumerator);

  let protocolFee = 0;
  let sellerAmount = 0;
  let buyerAmountBN = priceBN;

  if (method === 'hammer') {
    // hammer price takes the "price" as the amount that the seller gets and adds protocol and artist fees on tom of that
  } else if (method === 'inclusive') {
    // the alternative is that the price includes all the fees
    protocolFeeBN = priceBN.mul(protocolFeeNumeratorBN).div(protocolFeeDenominatorBN);
    // console.log("protocolFeeBN", protocolFeeBN.toString());
    sellerAmountBN = priceBN.sub(protocolFeeBN.add(artistAmountBN));
    // console.log("sellerAmountBN", sellerAmountBN.toString());
  }

  return { artistAmountBN, protocolFeeBN, sellerAmountBN, buyerAmountBN };
};

const listingStructToObject = (listing) => {
  const listingObject = {
    listPtr: listing.listPtr,
    nftAddress: listing.nftAddress,
    tokenId: listing.tokenId,
    seller: listing.seller,
    price: listing.price,
    paymentToken: listing.paymentToken,
    nftType: listing.nftType,
    reservedUntil: listing.reservedUntil,
    reservedFor: listing.reservedFor,
  };
  return listingObject;
};

const listItem = async (marketplace, nftAddress, tokenId, price, paymentToken, seller) => {
    await marketplace.list(nftAddress, tokenId, price, paymentToken, {
      from: seller,
    });
    let numListings = await marketplace.numListings.call();
    let lstPtr = Number(numListings.toString()) - 1;
    let listing = await marketplace.getListing(nftAddress, tokenId);
    return {
      listing,
      lstPtr,
    };
  };

module.exports = {
  calcFunds,
  listingStructToObject,
  listItem
};
