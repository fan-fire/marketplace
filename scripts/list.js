const ERC721WithERC2981Mock = artifacts.require('ERC721WithERC2981Mock');
const Marketplace = artifacts.require('Marketplace');

module.exports = (callback) => {
  marketplaceAddr = '0xED9E6336E40787e3D1d7BBf13b2d911f6858AEde';
  fanAddr = '0xbC2937E8417944cAea23e22eaC3f4bd8fFe21553';
  usdcAddr = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
  nftAddr = '0x2EAF0e71aA52d7587526904202509Eb45CDD9850';
  contractOwner = '0xC4E9C436C4aB9071F996487811F7FeC7CdeE16a7';
  nftOwnerAddr = '0xC9B40BB948F1CE6F9B68d15c1Fb8df54aAD5E532';
  royaltyBenAddr = '0xC4E9C436C4aB9071F996487811F7FeC7CdeE16a7';
  console.log('...');

  ERC721WithERC2981Mock.at(nftAddr).then((nftInstance) => {
    console.log('ERC721WithERC2981Mock address: ' + nftInstance.address);

    nftInstance
      .setApprovalForAll(marketplaceAddr, true, {
        from: nftOwnerAddr,
        gasPrice:36e9,
        gas: 395029
      })
      .then((tx) => {
        console.log('setApprovalForAll');
        console.dir(tx);
        callback();

        // function list(
        //     address nftAddress,
        //     uint256 tokenId,
        //     uint256 price,
        //     address paymentToken
        // )

        // Marketplace.at(marketplaceAddr).then((marketplaceInstance) => {
        //   console.log('Marketplace address: ' + marketplaceInstance.address);
        //   marketplaceInstance
        //     .list(nftOwnerAddr, 1, 1, usdcAddr, {
        //       from: nftOwnerAddr,
        //       gasPrice: 32*1e9,
        //       gas: 1000000,
        //     })
        //     .then((tx) => {
        //       console.log('list tx: ' + tx);

        //       callback();
        //     });
        // }).catch((err) => {
        //     console.log(err);
        //     });


      });
  });
};
